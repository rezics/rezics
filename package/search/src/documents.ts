// meili.documents.ts
import {
  bookIndex,
  unitIndex,
  readlistIndex,
  feedbackIndex,
  userIndex,
} from './meili_index';

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

// ANCHOR: Readlists
export async function addOrUpdateReadlists(readlists: any[]) {
  return readlistIndex.addDocuments(readlists);
}

export async function deleteReadlists(ids: string[]) {
  return readlistIndex.deleteDocuments(ids);
}

export async function deleteAllReadlists() {
  return readlistIndex.deleteAllDocuments();
}

// ANCHOR: Feedbacks
export async function addOrUpdateFeedbacks(feedbacks: any[]) {
  return feedbackIndex.addDocuments(feedbacks);
}

export async function deleteFeedbacks(ids: string[]) {
  return feedbackIndex.deleteDocuments(ids);
}

export async function deleteAllFeedbacks() {
  return feedbackIndex.deleteAllDocuments();
}

// ANCHOR: Users
export async function addOrUpdateUsers(users: any[]) {
  return userIndex.addDocuments(users);
}

export async function deleteUsers(ids: string[]) {
  return userIndex.deleteDocuments(ids);
}

export async function deleteAllUsers() {
  return userIndex.deleteAllDocuments();
}
