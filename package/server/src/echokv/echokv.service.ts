import { desc, eq, ilike } from "drizzle-orm";
import { db } from "../db/client";
import { EchoKV } from "../db/schema";
import type { JsonValue } from "./types";

export class EchoKvService {
  async get(key: string): Promise<JsonValue> {
    const [record] = await db
      .select({ value: EchoKV.value })
      .from(EchoKV)
      .where(eq(EchoKV.key, key))
      .limit(1);
    return record?.value as JsonValue;
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
    const now = new Date();
    const [record] = await db
      .insert(EchoKV)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: EchoKV.key,
        set: { value, updatedAt: now },
      })
      .returning({ value: EchoKV.value });
    return record?.value as JsonValue;
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
