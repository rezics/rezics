import type { EchoKvJsonValue } from "@rezics/contract";
import { desc, eq, ilike } from "drizzle-orm";
import { db } from "../db/client";
import { EchoKV } from "../db/schema";

export class EchoKvService {
  async get(key: string): Promise<EchoKvJsonValue> {
    const [record] = await db
      .select({ value: EchoKV.value })
      .from(EchoKV)
      .where(eq(EchoKV.key, key))
      .limit(1);
    return (record?.value ?? null) as EchoKvJsonValue;
  }

  /**
   * Upsert a value by key.
   *
   * - If the key exists, update its value
   * - Otherwise, create a new record
   *
   * NOTE:
   * EchoKV.value is a Json column, so we accept any EchoKvJsonValue here.
   * For use cases like the notice board editor, we typically store
   * a JSON-formatted string, which is then parsed on the client.
   */
  async set(key: string, value: EchoKvJsonValue): Promise<EchoKvJsonValue> {
    const now = new Date();
    const [record] = await db
      .insert(EchoKV)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: EchoKV.key,
        set: { value, updatedAt: now },
      })
      .returning({ value: EchoKV.value });
    return (record?.value ?? null) as EchoKvJsonValue;
  }

  /**
   * List all keys, optionally filtered by a search string.
   * Newest records come first.
   */
  async listKeys(search?: string): Promise<string[]> {
    const records = await db
      .select({ key: EchoKV.key })
      .from(EchoKV)
      .where(search ? ilike(EchoKV.key, `%${search}%`) : undefined)
      .orderBy(desc(EchoKV.updatedAt));

    return records.map((r) => r.key);
  }
}

export const echoKvService = new EchoKvService();
