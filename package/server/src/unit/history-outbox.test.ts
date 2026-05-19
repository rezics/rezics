import { describe, expect, mock, test } from "bun:test";
import { HistoryOutboxPayloadKind, UnitCommonFieldKey } from "@rezics/contract";
import {
  allocateUnitHistorySequence,
  buildEditorialRevisionPayload,
  buildStructureEventPayload,
  canonicalSerialize,
  hashCanonicalPayload,
  writeHistoryOutbox,
} from "./history-outbox";

describe("history outbox helpers", () => {
  test("canonical serialization is stable for object key order", () => {
    const a = { z: 1, a: { d: 2, b: 3 } };
    const b = { a: { b: 3, d: 2 }, z: 1 };

    expect(canonicalSerialize(a)).toBe(canonicalSerialize(b));
    expect(hashCanonicalPayload(a)).toBe(hashCanonicalPayload(b));
  });

  test("allocates sequences through the provided transaction", async () => {
    const tx = {
      $queryRaw: mock(async () => [{ sequence: 7n }]),
    };

    const sequence = await allocateUnitHistorySequence(tx as never, "unit-1");

    expect(sequence).toBe(7n);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("writes outbox row with distinct ordered per-Unit sequences", async () => {
    let next = 1n;
    const tx = {
      $queryRaw: mock(async () => [{ sequence: next++ }]),
      historyOutbox: {
        create: mock(async () => ({})),
      },
    };

    const firstPayload = {
      kind: HistoryOutboxPayloadKind.EDITORIAL_REVISION,
      revision: buildEditorialRevisionPayload({
        unitId: "unit-1",
        sequence: 1,
        actorUserId: "user-1",
        changedFieldKeys: [UnitCommonFieldKey.TITLE],
        slots: { unit: { title: "First" } },
      }),
    };
    const secondPayload = {
      kind: HistoryOutboxPayloadKind.EDITORIAL_REVISION,
      revision: buildEditorialRevisionPayload({
        unitId: "unit-1",
        sequence: 2,
        actorUserId: "user-1",
        changedFieldKeys: [UnitCommonFieldKey.TITLE],
        slots: { unit: { title: "Second" } },
      }),
    };

    const first = await writeHistoryOutbox(tx as never, {
      unitId: "unit-1",
      actorUserId: "user-1",
      payload: firstPayload,
    });
    const second = await writeHistoryOutbox(tx as never, {
      unitId: "unit-1",
      actorUserId: "user-1",
      payload: secondPayload,
    });

    expect(first.sequence).toBe(1n);
    expect(second.sequence).toBe(2n);
    expect(first.payloadHash).not.toBe(second.payloadHash);
    expect(tx.historyOutbox.create).toHaveBeenCalledTimes(2);
  });

  test("failed transaction callback does not write outbox after rollback point", async () => {
    const tx = {
      $queryRaw: mock(async () => [{ sequence: 1n }]),
      historyOutbox: {
        create: mock(async () => ({})),
      },
    };

    async function transaction(callback: (inner: typeof tx) => Promise<void>) {
      await callback(tx);
    }

    await expect(
      transaction(async () => {
        throw new Error("canonical write failed");
      }),
    ).rejects.toThrow("canonical write failed");

    expect(tx.historyOutbox.create).not.toHaveBeenCalled();
  });

  test("builds editorial and structure payloads without reading current state later", () => {
    const editorial = buildEditorialRevisionPayload({
      unitId: "unit-1",
      sequence: 3n,
      actorUserId: "user-1",
      changedFieldKeys: [UnitCommonFieldKey.TITLE],
      slots: { translations: [{ language: "en", title: "Captured" }] },
    });
    const structure = buildStructureEventPayload({
      unitId: "unit-1",
      sequence: 4n,
      actorUserId: "user-1",
      eventType: "book.contentStructure.node.update",
      changedFieldKeys: [UnitCommonFieldKey.TITLE],
      payload: { nodeId: "node-1", title: "Captured node" },
    });

    expect(editorial.slots.translations).toEqual([
      { language: "en", title: "Captured" },
    ]);
    expect(structure.payload).toEqual({
      nodeId: "node-1",
      title: "Captured node",
    });
  });
});
