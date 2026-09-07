import { describe, expect, it, vi } from "vitest";
import type { DatabaseTransaction } from "../database";
import { imageAsset } from "../database/schema/image";
import { erasePrivateImageBatch, type ImageErasureArchive } from "./erasure";

const authUserId = "019b76da-a800-7100-8000-000000000004";
const assetId = "019b76da-a800-7250-8000-000000000001";
const original = `image-objects/${assetId}/original`;
type StoredObject = { key: string; versionId: string | undefined; size: number | undefined };

function fixture(objects: StoredObject[]) {
	let row: typeof imageAsset.$inferSelect = {
		id: assetId,
		ownerAuthUserId: authUserId,
		uploaderAuthUserId: authUserId,
		access: "private",
		status: "ready",
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		contentErasedAt: null,
		erasureFenceVersionId: null,
	};
	const state = {
		objects,
		get row() {
			return row;
		},
	};
	const tx = {
		select: () => ({
			from: () => ({
				where: () => ({ limit: () => ({ for: async () => (row.contentErasedAt ? [] : [row]) }) }),
			}),
		}),
		update: () => ({
			set: (value: Partial<typeof row>) => ({
				where: async () => {
					row = { ...row, ...value };
				},
			}),
		}),
	} as unknown as DatabaseTransaction;
	const archive: ImageErasureArchive = {
		put: vi.fn(async () => {
			state.objects.unshift({ key: original, versionId: "empty-fence", size: 0 });
			return { VersionId: "empty-fence", $metadata: {} };
		}),
		listErasurePage: vi.fn(async () => ({
			objects: state.objects.slice(0, 500),
			truncated: state.objects.length > 500,
		})),
		deleteErasurePage: vi.fn(async (selected: readonly { key: string; versionId?: string }[]) => {
			const keys = new Set(selected.map((value) => `${value.key}:${value.versionId}`));
			state.objects = state.objects.filter((value) => !keys.has(`${value.key}:${value.versionId}`));
		}),
	};
	return { tx, archive, state };
}

describe("private image content erasure", () => {
	it("drains historical originals and more than one page of derived objects while retaining an empty upload fence", async () => {
		const { tx, archive, state } = fixture([
			{ key: original, versionId: "old-original", size: 9000 },
			...Array.from({ length: 1001 }, (_, index) => ({
				key: `image-objects/${assetId}/presentations/banner/v${index}/image.webp`,
				versionId: "1",
				size: 30,
			})),
		]);
		for (let index = 0; index < 8 && !state.row.contentErasedAt; index++)
			await erasePrivateImageBatch(tx, authUserId, archive);
		expect(state.row.contentErasedAt).toBeInstanceOf(Date);
		expect(state.objects).toEqual([{ key: original, versionId: "empty-fence", size: 0 }]);
		for (const [batch] of vi.mocked(archive.deleteErasurePage).mock.calls) {
			expect(batch.length).toBeLessThanOrEqual(500);
			expect(batch.some((value) => value.versionId === "empty-fence")).toBe(false);
		}
	});
	it("does not mark completion after an object-store failure and can resume the same page", async () => {
		const { tx, archive, state } = fixture([
			{ key: original, versionId: "old-original", size: 9000 },
		]);
		await erasePrivateImageBatch(tx, authUserId, archive);
		vi.mocked(archive.deleteErasurePage).mockRejectedValueOnce(
			new Error("temporary object-store failure"),
		);
		await expect(erasePrivateImageBatch(tx, authUserId, archive)).rejects.toThrow(
			"temporary object-store failure",
		);
		expect(state.row.contentErasedAt).toBeNull();
		await erasePrivateImageBatch(tx, authUserId, archive);
		await erasePrivateImageBatch(tx, authUserId, archive);
		expect(state.row.contentErasedAt).toBeInstanceOf(Date);
	});
	it("rejects an object store returning another asset's key before any deletion", async () => {
		const { tx, archive, state } = fixture([
			{ key: "image-objects/another-account/original", versionId: undefined, size: 9 },
		]);
		await erasePrivateImageBatch(tx, authUserId, archive);
		await expect(erasePrivateImageBatch(tx, authUserId, archive)).rejects.toThrow(
			"outside the admitted image prefix",
		);
		expect(archive.deleteErasurePage).not.toHaveBeenCalled();
		expect(state.row.contentErasedAt).toBeNull();
	});
});
