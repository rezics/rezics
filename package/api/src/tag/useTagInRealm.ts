/**
 * Double-write helper for tagging a unit "in a realm".
 *
 * The two layers — global (UnitTag) and realm (RealmTagUnit) — are
 * intentionally independent on the server: there is no cascade, and each
 * write is authority-checked separately. Tagging in a realm should write
 * BOTH so the tag becomes visible globally and inside the realm, but the
 * client must report partial success/failure honestly because either leg
 * can fail (e.g. the user is no longer a realm member, or rate-limited).
 *
 * The hook returns a single `mutate(args)` that fires both legs and a
 * structured result describing each leg, plus retry helpers for the
 * failing leg only.
 */

import type {
  CreateRealmTagUnitInput,
  CreateUnitTagInput,
} from "@rezics/contract";
import { useCallback, useState } from "react";
import { useCreateRealmTagUnitMutation } from "../realm/realm.mutations";
import { useCreateUnitTagMutation } from "./tag.mutations";

export type TagInRealmInput = {
  realmUnitId: string;
  unitId: string;
  tagUnitId: string;
};

export type TagInRealmLegStatus = "idle" | "pending" | "success" | "error";

export type TagInRealmResult = {
  global: { status: TagInRealmLegStatus; error: Error | null };
  realm: { status: TagInRealmLegStatus; error: Error | null };
};

export function useTagInRealm() {
  const createUnitTag = useCreateUnitTagMutation();
  const createRealmTagUnit = useCreateRealmTagUnitMutation();

  const [result, setResult] = useState<TagInRealmResult>({
    global: { status: "idle", error: null },
    realm: { status: "idle", error: null },
  });

  const mutate = useCallback(
    async (input: TagInRealmInput): Promise<TagInRealmResult> => {
      const globalInput: CreateUnitTagInput = {
        unitId: input.unitId,
        tagUnitId: input.tagUnitId,
      };
      const realmInput: CreateRealmTagUnitInput = {
        realmUnitId: input.realmUnitId,
        unitId: input.unitId,
        tagUnitId: input.tagUnitId,
      };

      setResult({
        global: { status: "pending", error: null },
        realm: { status: "pending", error: null },
      });

      const [globalSettled, realmSettled] = await Promise.allSettled([
        createUnitTag.mutateAsync(globalInput),
        createRealmTagUnit.mutateAsync(realmInput),
      ]);

      const next: TagInRealmResult = {
        global:
          globalSettled.status === "fulfilled"
            ? { status: "success", error: null }
            : { status: "error", error: asError(globalSettled.reason) },
        realm:
          realmSettled.status === "fulfilled"
            ? { status: "success", error: null }
            : { status: "error", error: asError(realmSettled.reason) },
      };
      setResult(next);
      return next;
    },
    [createUnitTag, createRealmTagUnit],
  );

  /**
   * Retry just the global leg using the same input.
   * No-op if the global leg already succeeded.
   */
  const retryGlobal = useCallback(
    async (input: TagInRealmInput) => {
      if (result.global.status === "success") return result;
      setResult((prev) => ({
        ...prev,
        global: { status: "pending", error: null },
      }));
      try {
        await createUnitTag.mutateAsync({
          unitId: input.unitId,
          tagUnitId: input.tagUnitId,
        });
        const next: TagInRealmResult = {
          ...result,
          global: { status: "success", error: null },
        };
        setResult(next);
        return next;
      } catch (err) {
        const next: TagInRealmResult = {
          ...result,
          global: { status: "error", error: asError(err) },
        };
        setResult(next);
        return next;
      }
    },
    [createUnitTag, result],
  );

  /**
   * Retry just the realm leg using the same input.
   * No-op if the realm leg already succeeded.
   */
  const retryRealm = useCallback(
    async (input: TagInRealmInput) => {
      if (result.realm.status === "success") return result;
      setResult((prev) => ({
        ...prev,
        realm: { status: "pending", error: null },
      }));
      try {
        await createRealmTagUnit.mutateAsync({
          realmUnitId: input.realmUnitId,
          unitId: input.unitId,
          tagUnitId: input.tagUnitId,
        });
        const next: TagInRealmResult = {
          ...result,
          realm: { status: "success", error: null },
        };
        setResult(next);
        return next;
      } catch (err) {
        const next: TagInRealmResult = {
          ...result,
          realm: { status: "error", error: asError(err) },
        };
        setResult(next);
        return next;
      }
    },
    [createRealmTagUnit, result],
  );

  return {
    mutate,
    retryGlobal,
    retryRealm,
    result,
    isPending:
      result.global.status === "pending" || result.realm.status === "pending",
  };
}

function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === "string" ? value : "Unknown error");
}
