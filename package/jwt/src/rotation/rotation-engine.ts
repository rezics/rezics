import type { JwtCryptoProvider } from "../contract/crypto-provider";
import type { JwtIssuerDescriptor } from "../contract/issuer";
import type { JwtKeyPersistence, JwtKeyRecord } from "../contract/persistence";
import { JwtAlgorithm } from "../core/jwt-algorithm";
import { selectActiveKey, selectPublishedKeys } from "./key-selection";
import {
  type JwtRotationConfig,
  type JwtRotationConfigInput,
  resolveRotationConfig,
} from "./rotation-config";
import type {
  JwtClock,
  JwtRotationEngine,
  RotationSchedule,
} from "./rotation-types";

const systemClock: JwtClock = {
  now: () => new Date(),
};

function createKid(now: Date): string {
  return `jwt-${now.toISOString()}`;
}

async function createKeyRecord(params: {
  issuer: string;
  now: Date;
  cryptoProvider: JwtCryptoProvider;
}): Promise<JwtKeyRecord> {
  const material = await params.cryptoProvider.generateKey();
  const kid = createKid(params.now);
  return {
    issuer: params.issuer,
    kid,
    algorithm: JwtAlgorithm.ES256,
    publicJwk: { ...material.publicJwk, kid },
    privateJwk: { ...material.privateJwk, kid },
    createdAt: params.now,
    activatesAt: params.now,
    retiresAt: null,
    expiresAt: null,
  };
}

function getRotationDueAt(
  key: JwtKeyRecord | null,
  config: JwtRotationConfig,
): Date | null {
  if (!key) return null;
  return new Date(key.createdAt.getTime() + config.rotationIntervalMs);
}

async function loadKeys(
  persistence: JwtKeyPersistence,
  issuer: string,
): Promise<JwtKeyRecord[]> {
  const keys = await persistence.listKeys({ issuer });
  return keys.map((key) => ({
    ...key,
    createdAt: new Date(key.createdAt),
    activatesAt: new Date(key.activatesAt),
    retiresAt: key.retiresAt ? new Date(key.retiresAt) : null,
    expiresAt: key.expiresAt ? new Date(key.expiresAt) : null,
  }));
}

export function createRotationEngine(params: {
  issuer: JwtIssuerDescriptor;
  config: JwtRotationConfigInput;
  persistence: JwtKeyPersistence;
  cryptoProvider: JwtCryptoProvider;
  clock?: JwtClock;
}): JwtRotationEngine {
  const config = resolveRotationConfig(params.config);
  const clock = params.clock ?? systemClock;

  async function ensureActiveKey(): Promise<JwtKeyRecord> {
    const now = clock.now();
    const keys = await loadKeys(params.persistence, params.issuer.issuer);
    const active = selectActiveKey(keys, now);
    if (active) return active;

    const created = await createKeyRecord({
      issuer: params.issuer.issuer,
      now,
      cryptoProvider: params.cryptoProvider,
    });
    await params.persistence.saveKey({
      issuer: params.issuer.issuer,
      key: created,
    });
    return created;
  }

  async function rotateIfDue(): Promise<JwtKeyRecord> {
    const now = clock.now();
    const keys = await loadKeys(params.persistence, params.issuer.issuer);
    const active = selectActiveKey(keys, now);

    if (!active) {
      return ensureActiveKey();
    }

    const dueAt = getRotationDueAt(active, config);
    if (!dueAt || dueAt.getTime() > now.getTime()) {
      return active;
    }

    const nextKey = await createKeyRecord({
      issuer: params.issuer.issuer,
      now,
      cryptoProvider: params.cryptoProvider,
    });

    await params.persistence.markKeyRetiring({
      issuer: params.issuer.issuer,
      kid: active.kid,
      retiresAt: now,
      expiresAt: new Date(now.getTime() + config.gracePeriodMs),
    });
    await params.persistence.saveKey({
      issuer: params.issuer.issuer,
      key: nextKey,
    });

    return nextKey;
  }

  async function getActiveSigningKey(): Promise<JwtKeyRecord> {
    return rotateIfDue();
  }

  async function getPublicJwks() {
    const now = clock.now();
    const keys = selectPublishedKeys(
      await loadKeys(params.persistence, params.issuer.issuer),
      now,
    );

    return {
      keys: await Promise.all(keys.map(async (key) => key.publicJwk)),
    };
  }

  async function getSchedule(): Promise<RotationSchedule> {
    const checkedAt = clock.now();
    const keys = await loadKeys(params.persistence, params.issuer.issuer);
    const active = selectActiveKey(keys, checkedAt);
    const nextRotationAt = getRotationDueAt(active, config);

    return {
      checkedAt,
      nextCheckAt: new Date(checkedAt.getTime() + config.checkIntervalMs),
      nextRotationAt,
      isRotationDue:
        nextRotationAt !== null &&
        nextRotationAt.getTime() <= checkedAt.getTime(),
    };
  }

  return {
    ensureActiveKey,
    rotateIfDue,
    getActiveSigningKey,
    getPublicJwks,
    getSchedule,
  };
}
