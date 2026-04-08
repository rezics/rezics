import type { BookDTO } from "@rezics/contract";
import { sanitizeUser, sanitizeUserWithBio } from "@/utils/sanitizeUser";
import type { BookWithRelations } from "./types";

/**
 * Map internal Book model to BookDTO
 */
export function mapBaseBookToDTO(book: BookWithRelations): BookDTO {
  return {
    unitId: book.unitId,
    title: book.title,
    author: book.author.map(sanitizeUser),
    press: book.press.map(sanitizeUser),
    producer: book.producer.map(sanitizeUser),
    coverUrl: book.coverUrl || undefined,
    isbn: book.isbn || undefined,
    textLength: book.textLength.toString() || "0",
    nsfw: book.unit.nsfw || undefined,
    isLicensed: book.isLicensed || undefined,
    userId: book.unit.userId,
    user: sanitizeUser(book.unit.user),
    tags: book.unit.tags?.map((tag) => tag.name) || [],
    reactionSummaries: book.unit.reactionSummaries,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    description: book.description || undefined,
  };
}

export function mapBookToDTO(book: BookWithRelations): BookDTO {
  return {
    ...mapBaseBookToDTO(book),
    // chaptersIndex: book.chaptersIndex || undefined,
    author: book.author.map(sanitizeUserWithBio),
    extra: (book.extra as Record<string, unknown>) || undefined,
  };
}
