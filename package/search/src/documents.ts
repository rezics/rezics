// meili.documents.ts
import {bookIndex, unitIndex} from './meili_index';

// ANCHOR: Books
export async function addOrUpdateBooks(books: any[]) {
  return bookIndex.addDocuments(books);
}

export async function deleteBooks(ids: string[]) {
  return bookIndex.deleteDocuments(ids);
}

export async function deleteAllBooks() {
  return bookIndex.deleteAllDocuments();
}

// ANCHOR: Units
export async function addOrUpdateUnits(units: any[]) {
  return unitIndex.addDocuments(units);
}

export async function deleteUnits(ids: string[]) {
  return unitIndex.deleteDocuments(ids);
}

export async function deleteAllUnits() {
  return unitIndex.deleteAllDocuments();
}
