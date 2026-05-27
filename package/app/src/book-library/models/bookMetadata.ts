import type { BookDTO } from "@rezics/contract";

export function resolveMetadataPanelUswn(bookInfo: BookDTO): string | null {
  return bookInfo.metadata?.uswn ?? null;
}
