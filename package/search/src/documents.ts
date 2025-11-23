// meili.documents.ts
import {bookIndex} from './meili_index';

export async function addOrUpdateBooks(books: any[]) {
  return bookIndex.addDocuments(books);
}

export async function deleteBooks(ids: string[]) {
  return bookIndex.deleteDocuments(ids);
}

export async function deleteAllBooks() {
  return bookIndex.deleteAllDocuments();
}
