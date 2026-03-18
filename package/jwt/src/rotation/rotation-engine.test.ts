import {describe, expect, test} from 'bun:test';
import type {JwtCryptoProvider} from '../contracts/crypto-provider';
import type {JwtKeyPersistence, JwtKeyRecord} from '../contracts/persistence';
import {JwtAlgorithm} from '../core/jwt-algorithm';
import {createRotationEngine} from './rotation-engine';
import type {JwtClock} from './rotation-types';

function createMemoryPersistence(seed: JwtKeyRecord[] = []): JwtKeyPersistence {
  const keys = [...seed];

  return {
    async listKeys({issuer}) {
      return keys.filter(key => key.issuer === issuer);
    },
    async saveKey({key}) {
      keys.push(key);
    },
    async markKeyRetiring({issuer, kid, retiresAt, expiresAt}) {
      const record = keys.find(key => key.issuer === issuer && key.kid === kid);
      if (!record) throw new Error(`Key ${kid} not found`);
      record.retiresAt = retiresAt;
      record.expiresAt = expiresAt;
    },
    async getKeyByKid({issuer, kid}) {
      return keys.find(key => key.issuer === issuer && key.kid === kid) ?? null;
    },
  };
}

function createClock(now: Date): JwtClock & {setNow(next: Date): void} {
  let current = now;
  return {
    now() {
      return current;
    },
    setNow(next) {
      current = next;
    },
  };
}

function createCryptoProvider(): JwtCryptoProvider {
  let counter = 0;
  return {
    generateKey() {
      counter += 1;
      return {
        privateKeyPem: `private-${counter}`,
        publicKeyPem: `public-${counter}`,
      };
    },
  };
}

describe('rotation engine', () => {
  test('uses default rotation scheduling values', async () => {
    const clock = createClock(new Date('2026-01-01T00:00:00.000Z'));
    const engine = createRotationEngine({
      issuer: {
        issuer: 'https://issuer.example',
        audience: 'rezics-api',
        algorithm: JwtAlgorithm.ES256,
        jwksPath: '/jwks',
      },
      config: {
        tokenTtlMs: 15 * 60 * 1000,
      },
      persistence: createMemoryPersistence(),
      cryptoProvider: createCryptoProvider(),
      clock,
    });

    await engine.ensureActiveKey();
    const schedule = await engine.getSchedule();

    expect(schedule.nextCheckAt.toISOString()).toBe('2026-01-01T00:01:00.000Z');
    expect(schedule.nextRotationAt?.toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    );
    expect(schedule.isRotationDue).toBe(false);
  });

  test('rotates when the interval has elapsed and retains the previous key', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const oldKey: JwtKeyRecord = {
      issuer: 'https://issuer.example',
      kid: 'kid-old',
      algorithm: JwtAlgorithm.ES256,
      publicKeyPem: 'public-old',
      privateKeyPem: 'private-old',
      createdAt,
      activatesAt: createdAt,
      retiresAt: null,
      expiresAt: null,
    };
    const persistence = createMemoryPersistence([oldKey]);
    const clock = createClock(new Date('2026-04-02T00:00:00.000Z'));
    const engine = createRotationEngine({
      issuer: {
        issuer: 'https://issuer.example',
        audience: 'rezics-api',
        algorithm: JwtAlgorithm.ES256,
        jwksPath: '/jwks',
      },
      config: {
        tokenTtlMs: 5 * 60 * 1000,
      },
      persistence,
      cryptoProvider: createCryptoProvider(),
      clock,
    });

    const active = await engine.rotateIfDue();
    const keys = await persistence.listKeys({issuer: 'https://issuer.example'});
    const retired = keys.find(key => key.kid === 'kid-old');

    expect(active.kid).not.toBe('kid-old');
    expect(retired?.retiresAt?.toISOString()).toBe('2026-04-02T00:00:00.000Z');
    expect(retired?.expiresAt?.toISOString()).toBe('2026-04-02T00:10:00.000Z');
  });

  test('returns the newest active key when multiple keys exist', async () => {
    const engine = createRotationEngine({
      issuer: {
        issuer: 'https://issuer.example',
        audience: 'rezics-api',
        algorithm: JwtAlgorithm.ES256,
        jwksPath: '/jwks',
      },
      config: {
        tokenTtlMs: 5 * 60 * 1000,
      },
      persistence: createMemoryPersistence([
        {
          issuer: 'https://issuer.example',
          kid: 'older',
          algorithm: JwtAlgorithm.ES256,
          publicKeyPem: 'public-1',
          privateKeyPem: 'private-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          activatesAt: new Date('2026-01-01T00:00:00.000Z'),
          retiresAt: new Date('2026-01-09T00:00:00.000Z'),
          expiresAt: new Date('2026-01-11T00:00:00.000Z'),
        },
        {
          issuer: 'https://issuer.example',
          kid: 'newer',
          algorithm: JwtAlgorithm.ES256,
          publicKeyPem: 'public-2',
          privateKeyPem: 'private-2',
          createdAt: new Date('2026-01-09T00:00:00.000Z'),
          activatesAt: new Date('2026-01-09T00:00:00.000Z'),
          retiresAt: null,
          expiresAt: null,
        },
      ]),
      cryptoProvider: createCryptoProvider(),
      clock: createClock(new Date('2026-01-10T00:00:00.000Z')),
    });

    const active = await engine.getActiveSigningKey();
    expect(active.kid).toBe('newer');
  });
});
