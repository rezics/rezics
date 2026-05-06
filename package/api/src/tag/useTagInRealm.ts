/**
 * Legacy helper for tagging a unit "in a realm".
 *
 * The standard backend-owned path is `POST /realm-tag-units`: it writes the
 * realm-scoped application and idempotently contributes the caller's global
 * TagVote. This hook keeps the old result shape for callers, but only sends
 * the realm-tag request. The `global` leg reflects the backend-owned
 * contribution rather than a separate client request.
 *
 * The hook returns a single `mutate(args)` and a structured result describing
 * the backend-owned global contribution and realm application.
 */

import type { CreateRealmTagUnitInput } from "@rezics/contract";
import { useCallback, useState } from "react";
import { useCreateRealmTagUnitMutation } from "../realm/realm.mutations";

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
  const createRealmTagUnit = useCreateRealmTagUnitMutation();

  const [result, setResult] = useState<TagInRealmResult>({
    global: { status: "idle", error: null },
    realm: { status: "idle", error: null },
  });

  const mutate = useCallback(
    async (input: TagInRealmInput): Promise<TagInRealmResult> => {
      const realmInput: CreateRealmTagUnitInput = {
        realmUnitId: input.realmUnitId,
        unitId: input.unitId,
        tagUnitId: input.tagUnitId,
      };

      setResult({
        global: { status: "pending", error: null },
        realm: { status: "pending", error: null },
      });

      const [realmSettled] = await Promise.allSettled([
        createRealmTagUnit.mutateAsync(realmInput),
      ]);

      const next: TagInRealmResult = {
        global:
          realmSettled.status === "fulfilled"
            ? { status: "success", error: null }
            : { status: "error", error: asError(realmSettled.reason) },
        realm:
          realmSettled.status === "fulfilled"
            ? { status: "success", error: null }
            : { status: "error", error: asError(realmSettled.reason) },
      };
      setResult(next);
      return next;
    },
    [createRealmTagUnit],
  );

  /**
   * The global leg is backend-owned by the realm-tag request.
   */
  const retryGlobal = useCallback(
    async (_input: TagInRealmInput) => {
      return result;
    },
    [result],
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
