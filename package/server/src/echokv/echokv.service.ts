import {prisma, Prisma} from '@/prisma/client';

type JsonValue = Prisma.JsonValue;
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

  /**
   * List all keys, optionally filtered by a search string.
   * Newest records come first.
   */
  async listKeys(search?: string): Promise<string[]> {
    const records = await prisma.echoKV.findMany({
      ...(search
        ? {
            where: {
              key: {
                contains: search,
                mode: 'insensitive',
              },
            },
          }
        : {}),
      select: {
        key: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return records.map(r => r.key);
  }
}

export const echoKvService = new EchoKvService();
