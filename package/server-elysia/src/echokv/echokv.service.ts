import {prisma} from '@/prisma/client';
import type {JsonValue} from '@prisma/client/runtime/library';

export class EchoKvService {
  async get(key: string): Promise<JsonValue> {
    const value = await prisma.echoKV.findUnique({
      where: {key},
    });
    return value?.value as JsonValue;
  }
}

export const echoKvService = new EchoKvService();
