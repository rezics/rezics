import { prisma } from "#/prisma/client";
import { bookInclude } from "../../book/types";
import { searchClient } from "../search-client";
import type { BookSearchDocument } from "./index";

// TODO(search-redesign): replaced by unified content index

/**
 * Sync a single book (by its unitId) into the Meilisearch `books` index.
 * Updated for new schema: UnitTranslation for title, PersonCredit/OrgCredit for names, UnitTag for tags.
 */
export async function syncBookToMeili(unitId: string): Promise<void> {
  const book = await prisma.book.findUnique({
    where: { unitId },
    include: bookInclude,
  });

  if (!book) return;

  const unit = book.unit;

  // Resolve title/description from UnitTranslation
  const titleTranslation = unit?.translations?.find(
    (t) => t.title,
  );
  const descTranslation = unit?.translations?.find(
    (t) => t.description,
  );

  // Resolve tag labels from UnitTag -> tag.translations
  const tagSearch: string[] = (unit?.unitTags ?? [])
    .map(
      (ut) =>
        ut.tag?.translations?.find((t) => t.title)?.title ?? "",
    )
    .filter(Boolean);

  // Resolve credits from PersonCredit/OrgCredit
  const authorCredits = (unit?.personCredits ?? []).filter(
    (c) => c.roleKey === "author",
  );
  const pressCredits = (unit?.organizationCredits ?? []).filter(
    (c) => c.roleKey === "press" || c.roleKey === "publisher",
  );
  const producerCredits = (unit?.personCredits ?? []).filter(
    (c) => c.roleKey === "producer",
  );

  const doc: BookSearchDocument = {
    id: book.unitId,
    // search fields
    title: titleTranslation?.title ?? "",
    description: descTranslation?.description ?? null,
    coverUrl: null, // TODO(search-redesign): coverAssetUnitId lookup
    isbn: book.isbn13 ?? null,
    tagSearch,
    authors: authorCredits.map((c) => c.person?.name ?? ""),
    presses: pressCredits.map((c) => c.organization?.name ?? ""),
    producers: producerCredits.map((c) => c.person?.name ?? ""),
    nsfw: unit?.nsfw ?? false,
    isLicensed: book.isLicensed ?? false,
    authorIds: authorCredits.map((c) => c.personId),
    pressIds: pressCredits.map((c) => c.organizationId),
    producerIds: producerCredits.map((c) => c.personId),
    textLength: Number(book.textLength) ?? 0,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    extra: book.extra ?? null,
    metadata: unit?.extra ?? null,
    // result fields
    unitId: book.unitId,
    author: authorCredits.map((c) => c.person),
    press: pressCredits.map((c) => c.organization),
    producer: producerCredits.map((c) => c.person),
    tags: (unit?.unitTags ?? []).map((ut) => ({
      unitId: ut.tagUnitId,
      label: ut.tag?.translations?.find((t) => t.title)?.title ?? "",
      score: ut.score,
    })),
  };

  await searchClient.bookIndex.addDocuments([doc]);
}

/**
 * Remove a single book (by its unitId) from the Meilisearch `books` index.
 */
export async function deleteBookFromMeili(unitId: string): Promise<void> {
  await searchClient.bookIndex.deleteDocuments([unitId]);
}
