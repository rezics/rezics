import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    /*
     * Server Runtime & Infrastructure
     * 服务器运行时与基础设施
     */

    /**
     * Auth service runtime mode. Non-production modes log notifications instead of sending emails.
     * 认证服务运行模式。非生产模式记录通知日志而不发送邮件。
     */
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),

    /**
     * HTTP listen port. Defaults to '3001'.
     * HTTP 监听端口。默认为 '3001'。
     */
    PORT: v.fallback(v.string(), "3001"),

    /**
     * Observability log output mode: local text or newline-delimited JSON.
     * 可观测性日志输出模式：本地文本或换行分隔的 JSON。
     */
    OBSERVABILITY_LOG_FORMAT: v.optional(
      v.union([v.literal("local"), v.literal("json")]),
    ),
    /**
     * Enables ANSI color for local observability output.
     * 为本地可观测性输出启用 ANSI 颜色。
     */
    OBSERVABILITY_COLOR: v.optional(v.string()),
    /**
     * Slow HTTP request threshold in milliseconds.
     * 慢速 HTTP 请求阈值（毫秒）。
     */
    OBSERVABILITY_SLOW_REQUEST_MS: v.optional(v.string()),
    /**
     * OpenTelemetry mode: auto, disabled, enabled, or required.
     * OpenTelemetry 模式：auto、disabled、enabled 或 required。
     */
    OBSERVABILITY_TELEMETRY: v.optional(
      v.union([
        v.literal("auto"),
        v.literal("disabled"),
        v.literal("enabled"),
        v.literal("required"),
      ]),
    ),
    /**
     * OTLP HTTP traces endpoint. When omitted, telemetry export is disabled.
     * OTLP HTTP traces 端点。省略时禁用遥测导出。
     */
    OTEL_EXPORTER_OTLP_ENDPOINT: v.optional(v.string()),

    /**
     * PostgreSQL connection string for auth data persistence.
     * 用于认证数据持久化的 PostgreSQL 连接字符串。
     */
    DATABASE_URL: v.optional(v.string()),
    AUTH_DATABASE_URL: v.optional(v.string()),

    /*
     * Better Auth Core Configuration
     * Better Auth 核心配置
     */

    /**
     * Internal/native base URL for the auth service. Public product flows use
     * AUTH_PUBLIC_BASE_URL through the main server boundary.
     * 认证服务的内部/原生基础 URL。面向公开的产品流程经由 main 服务器边界使用
     * AUTH_PUBLIC_BASE_URL。
     */
    BETTER_AUTH_URL: v.string(),

    /**
     * Browser-facing auth base URL exposed by main, e.g. https://rezics.com/auth.
     * 由 main 暴露的面向浏览器的认证基础 URL，例如 https://rezics.com/auth。
     */
    AUTH_PUBLIC_BASE_URL: v.string(),

    /**
     * Public OAuth/OIDC issuer URL, e.g. https://rezics.com.
     * 公开的 OAuth/OIDC 签发者 URL，例如 https://rezics.com。
     */
    AUTH_PUBLIC_ISSUER_URL: v.string(),

    /**
     * Primary secret for session and internal crypto. Must be high-entropy and unique.
     * 用于会话和内部加密的主密钥。必须具有高熵且唯一。
     */
    BETTER_AUTH_SECRET: v.string(),

    /**
     * Supplemental secrets for planned secret rotation.
     * 用于计划中的密钥轮换的补充密钥。
     */
    BETTER_AUTH_SECRETS: v.optional(v.string()),

    /*
     * Internal Security & Routing
     * 内部安全与路由
     */

    /**
     * API route prefix for auth endpoints. Defaults to '/api/auth'.
     * 认证端点的 API 路由前缀。默认为 '/api/auth'。
     */
    AUTH_OPENAPI_ROUTER_PREFIX: v.fallback(v.string(), "/api/auth"),

    /**
     * Shared secret for service-to-service calls across internal boundaries.
     * 用于跨内部边界的服务间调用的共享密钥。
     */
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: v.string(),

    /**
     * Supplemental list of trusted origins for auth flows.
     * 认证流程的补充可信来源列表。
     */
    AUTH_TRUSTED_ORIGINS: v.optional(v.string()),

    /*
     * JWT & JWKS Management
     * Settings for token issuance and signing key rotation.
     * JWT 与 JWKS 管理
     * 令牌签发和签名密钥轮换的设置。
     */

    /**
     * Bootstrap-only override for the auth-local JWT audience.
     * Steady-state runtime metadata is persisted in the auth JWT service registry.
     * 仅用于引导阶段覆盖 auth-local JWT 的 audience。
     * 稳态运行时元数据持久化在认证 JWT 服务注册表中。
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),
    /**
     * Bootstrap-only override for the auth-local JWT issuer.
     * Steady-state runtime metadata is persisted in the auth JWT service registry.
     * 仅用于引导阶段覆盖 auth-local JWT 的 issuer。
     * 稳态运行时元数据持久化在认证 JWT 服务注册表中。
     */
    AUTH_JWT_ISSUER: v.optional(v.string()),
    /**
     * Bootstrap-only override for auth-issued JWT lifetime.
     * Use only for migration or emergency rotation tuning.
     * 仅用于引导阶段覆盖认证签发的 JWT 生命周期。
     * 仅在迁移或紧急轮换调优时使用。
     */
    AUTH_JWT_TTL_SECONDS: v.optional(v.string()),
    /**
     * Bootstrap-only override for auth signing-key rotation cadence.
     * 仅用于引导阶段覆盖认证签名密钥的轮换节奏。
     */
    AUTH_JWKS_ROTATION_INTERVAL_SECONDS: v.optional(v.string()),
    /**
     * Bootstrap-only override for auth JWKS grace-period publication.
     * 仅用于引导阶段覆盖认证 JWKS 宽限期发布。
     */
    AUTH_JWKS_GRACE_PERIOD_SECONDS: v.optional(v.string()),

    /*
     * Mail Transport (SMTP)
     * Configures the delivery mechanism for outbound emails.
     * 邮件传输 (SMTP)
     * 配置出站邮件的投递机制。
     */

    SMTP_HOST: v.string(),
    SMTP_PORT: v.fallback(v.string(), "465"),
    SMTP_SECURE: v.fallback(v.string(), "true"),
    SMTP_USER: v.string(),
    SMTP_PASSWORD: v.string(),
    SMTP_USER_NAME: v.optional(v.string()),

    /*
     * Email Templates & Senders
     * Defines the 'From' address for different notification types.
     * 邮件模板与发件人
     * 为不同通知类型定义 'From' 地址。
     */

    AUTH_PASSWORD_RESET_FROM_EMAIL: v.fallback(
      v.string(),
      "noreply@rezics.com",
    ),
    AUTH_VERIFICATION_FROM_EMAIL: v.fallback(v.string(), "noreply@rezics.com"),

    /*
     * OAuth Provider Credentials
     * Client IDs and Secrets for external identity providers.
     * Only required if the respective provider is enabled.
     * OAuth 提供商凭据
     * 外部身份提供商的 Client ID 和 Secret。
     * 仅在启用对应提供商时才需要。
     */

    // Google
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),

    // Microsoft
    MICROSOFT_CLIENT_ID: v.optional(v.string()),
    MICROSOFT_CLIENT_SECRET: v.optional(v.string()),

    // GitHub
    GITHUB_CLIENT_ID: v.optional(v.string()),
    GITHUB_CLIENT_SECRET: v.optional(v.string()),

    // Twitter
    TWITTER_CLIENT_ID: v.optional(v.string()),
    TWITTER_CLIENT_SECRET: v.optional(v.string()),

    // Telegram
    TELEGRAM_CLIENT_ID: v.optional(v.string()),
    TELEGRAM_CLIENT_SECRET: v.optional(v.string()),

    /*
     * Turnstile (Cloudflare CAPTCHA)
     * Turnstile (Cloudflare 人机验证)
     */

    TURNSTILE_SECRET: v.string(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

const authDatabaseUrl = env.AUTH_DATABASE_URL ?? env.DATABASE_URL;

if (!authDatabaseUrl) {
  throw new Error("AUTH_DATABASE_URL or DATABASE_URL is required");
}

export const authEnv = {
  ...env,
  AUTH_DATABASE_URL: authDatabaseUrl,
  DATABASE_URL: authDatabaseUrl,
};
