import {prisma, Prisma} from '@/prisma/client';
import type {JsonValue} from '@prisma/client/runtime/library';

export class EchoKvService {
  async get(key: string): Promise<JsonValue> {
    const value = await prisma.echoKV.findUnique({
      where: {key},
    });
    return value?.value as JsonValue;
  }

  /**
   * Upsert a value by key.
   *
   * - If the key exists, update its value
   * - Otherwise, create a new record
   *
   * NOTE:
   * EchoKV.value is a Json column, so we accept any JsonValue here.
   * For use cases like the notice board editor, we typically store
   * a JSON-formatted string, which is then parsed on the client.
   */
  async set(key: string, value: JsonValue): Promise<JsonValue> {
    const record = await prisma.echoKV.upsert({
      where: {key},
      update: {value: value as Prisma.InputJsonValue},
      create: {key, value: value as Prisma.InputJsonValue},
    });
    return record.value as JsonValue;
  }
}

export const echoKvService = new EchoKvService();
