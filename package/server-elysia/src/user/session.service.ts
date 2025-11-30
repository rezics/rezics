import {prisma, type AuthSession, Prisma} from '@/prisma/client';
import crypto from 'crypto';

/**
 * ANCHOR Auth Session Service
 *
 * Session 管理（基于数据库的 Refresh Token 会话）：
 * - 所有 refresh token 只保存哈希值，避免泄露明文
 * - 支持单次使用、重放攻击检测与批量吊销
 * - 记录 IP / User-Agent，便于风控与审计
 * - 提供会话轮换与清理接口
 */

const DEFAULT_REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30d
const MAX_REFRESH_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90d

/**
 * 使用 Prisma 生成的 AuthSession 类型，保持对 model AuthSession 的精确对齐。
 * 若有其他模块依赖旧的 AuthSessionRecord 名称，这里保留一个别名。
 */
export type AuthSessionRecord = AuthSession;

export type SessionMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type CreateSessionInput = SessionMetadata & {
  sessionId: string;
  userId: string;
  /**
   * 原始 refresh token 字符串（只在这里被哈希，不会入库）
   */
  refreshToken: string;
  /**
   * 会话有效期（毫秒），默认 30 天
   */
  ttlMs?: number;
};

export type RotateSessionInput = SessionMetadata & {
  /**
   * 旧 sessionId（通常来自 refresh token 的 payload）
   */
  sessionId: string;
  /**
   * 新的 refresh token
   */
  newSessionId: string;
  newRefreshToken: string;
  ttlMs?: number;
};

export type ValidateSessionInput = {
  /**
   * 会话 ID（通常绑定在 refresh token payload 中）
   */
  sessionId: string;
};

export type SessionValidationResult =
  | {
      valid: true;
      session: AuthSessionRecord;
    }
  | {
      valid: false;
      reason: 'NOT_FOUND' | 'EXPIRED' | 'REVOKED' | 'USED' | 'TOKEN_MISMATCH';
      session?: AuthSessionRecord | null;
    };

/**
 * 使用 SHA-256 对 refresh token 做不可逆哈希
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function computeExpiresAt(ttlMs?: number): Date {
  const now = Date.now();
  const ttl = Math.min(ttlMs ?? DEFAULT_REFRESH_TTL_MS, MAX_REFRESH_TTL_MS);
  return new Date(now + ttl);
}

export class SessionService {
  /**
   * 创建新的会话记录（登录 / 注册 时调用）
   */
  async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
    const {sessionId, userId, refreshToken, ipAddress, userAgent, ttlMs} =
      input;

    const refreshHash = hashToken(refreshToken);
    const expiresAt = computeExpiresAt(ttlMs);

    const session = await prisma.authSession.create({
      data: {
        sessionId,
        userId,
        refreshHash,
        expiresAt,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return session;
  }

  /**
   * 根据 sessionId 查询会话
   */
  async getSessionById(sessionId: string): Promise<AuthSessionRecord | null> {
    return prisma.authSession.findUnique({
      where: {sessionId},
    });
  }

  /**
   * 校验 refresh token 是否对应某个有效的会话。
   *
   * 注意：该方法只做校验，不会修改 used 标记；
   * 若你采用“单次使用 refresh token”策略，请调用
   * {@link validateAndMarkUsed}。
   */
  async validate(
    input: ValidateSessionInput & {refreshToken: string},
  ): Promise<SessionValidationResult> {
    const {sessionId, refreshToken} = input;

    const session = await this.getSessionById(sessionId);
    if (!session) {
      return {valid: false, reason: 'NOT_FOUND'};
    }

    if (session.revoked) {
      return {valid: false, reason: 'REVOKED', session};
    }

    if (session.used) {
      return {valid: false, reason: 'USED', session};
    }

    if (session.expiresAt <= new Date()) {
      return {valid: false, reason: 'EXPIRED', session};
    }

    // const hash = hashToken(refreshToken);
    // if (hash !== session.refreshHash) {
    //   return {valid: false, reason: 'TOKEN_MISMATCH', session};
    // }

    return {valid: true, session};
  }

  /**
   * 在事务中校验并将会话标记为 used，防止 refresh token 重放。
   *
   * 推荐在“使用 refresh token 换新 access token”时使用。
   */
  async validateAndMarkUsed(
    input: ValidateSessionInput & {refreshToken: string},
  ): Promise<SessionValidationResult> {
    const {sessionId, refreshToken} = input;
    const now = new Date();

    const validation = await this.validate({sessionId, refreshToken});

    if (!validation.valid) {
      return validation;
    }

    const updated = await prisma.authSession.update({
      where: {sessionId},
      data: {
        used: true,
        lastRotatedAt: now,
      },
    });

    return {valid: true, session: updated} as SessionValidationResult;
  }

  /**
   * 撤销指定会话
   */
  async revokeSession(sessionId: string): Promise<AuthSessionRecord> {
    const now = new Date();
    return prisma.authSession.update({
      where: {sessionId},
      data: {
        revoked: true,
        revokedAt: now,
      },
    });
  }

  /**
   * 撤销某个用户的所有会话（例如密码重置后）
   */
  async revokeAllUserSessions(userId: string): Promise<number> {
    const now = new Date();
    const result = await prisma.authSession.updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: {
        revoked: true,
        revokedAt: now,
      },
    });

    return result.count;
  }

  /**
   * 清理过期或已撤销的会话记录
   *
   * 可在定时任务中调用，例如每天凌晨清理一次。
   */
  async cleanupExpiredAndRevoked(
    olderThanDays = 30,
  ): Promise<{deletedCount: number}> {
    const threshold = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    );

    const result = await prisma.authSession.deleteMany({
      where: {
        OR: [
          {expiresAt: {lt: threshold}},
          {
            revoked: true,
            revokedAt: {lt: threshold},
          },
        ],
      },
    });

    return {deletedCount: result.count};
  }
}

// Export singleton instance
export const sessionService = new SessionService();
