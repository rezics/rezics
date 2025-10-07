/**
 * Book Service Usage Examples
 * 
 * This file demonstrates how to use the refactored Book service
 * in different scenarios.
 */

import {bookService} from './service';
import type {BookCreateRequest, BookUpdateRequest} from './types';

/**
 * Example 1: Create a new book
 */
export async function exampleCreateBook() {
  const newBook: BookCreateRequest = {
    userId: 'user-123',
    title: 'The Great Gatsby',
    authorIds: ['author-456'],
    isbn: '978-0743273565',
    coverUrl: 'https://example.com/cover.jpg',
    chaptersIndex: JSON.stringify([
      {id: '1', title: 'Chapter 1', page: 1},
      {id: '2', title: 'Chapter 2', page: 25},
    ]),
    extra: {
      publisher: 'Scribner',
      publishYear: 1925,
      language: 'English',
    },
  };

  const book = await bookService.create(newBook);
  console.log('Created book:', book.postId);
  return book;
}

/**
 * Example 2: List books with filters
 */
export async function exampleListBooks() {
  const {books, total} = await bookService.list({
    q: 'gatsby',
    page: 1,
    limit: 20,
    tags: 'fiction,classic',
  });

  console.log(`Found ${total} books`);
  books.forEach(book => {
    console.log(`- ${book.title} by ${book.authors.map(a => a.name).join(', ')}`);
  });

  return {books, total};
}

/**
 * Example 3: Get book by postId
 */
export async function exampleGetBook(postId: string) {
  const book = await bookService.getByPostId(postId);
  console.log('Book details:', {
    title: book.title,
    authors: book.authors.map(a => a.name),
    isbn: book.isbn,
  });
  return book;
}

/**
 * Example 4: Update a book
 */
export async function exampleUpdateBook(postId: string) {
  const updates: BookUpdateRequest = {
    title: 'The Great Gatsby (Updated Edition)',
    coverUrl: 'https://example.com/new-cover.jpg',
    extra: {
      publisher: 'Scribner',
      publishYear: 2004,
      edition: 'Reprint',
    },
  };

  const updatedBook = await bookService.update(postId, updates);
  console.log('Updated book:', updatedBook.title);
  return updatedBook;
}

/**
 * Example 5: Search books by ISBN
 */
export async function exampleSearchByIsbn(isbn: string) {
  const book = await bookService.getByIsbn(isbn);
  if (book) {
    console.log('Found book by ISBN:', book.title);
  } else {
    console.log('No book found with ISBN:', isbn);
  }
  return book;
}

/**
 * Example 6: Get books by user
 */
export async function exampleGetUserBooks(userId: string) {
  const books = await bookService.getByUserId(userId);
  console.log(`User has ${books.length} books`);
  return books;
}

/**
 * Example 7: Get books by author
 */
export async function exampleGetAuthorBooks(authorId: string) {
  const books = await bookService.getByAuthorId(authorId);
  console.log(`Author has written ${books.length} books`);
  return books;
}

/**
 * Example 8: Delete a book
 */
export async function exampleDeleteBook(postId: string) {
  const exists = await bookService.exists(postId);
  if (exists) {
    await bookService.delete(postId);
    console.log('Book deleted successfully');
  } else {
    console.log('Book not found');
  }
}

/**
 * Example 9: Complex search with multiple filters
 */
export async function exampleAdvancedSearch() {
  const {books, total} = await bookService.list({
    q: 'science',
    tags: 'fiction,space',
    authorIds: 'author-1,author-2,author-3',
    page: 1,
    limit: 50,
  });

  console.log(`Advanced search found ${total} books`);
  return {books, total};
}

/**
 * Example 10: Paginated listing
 */
export async function examplePagination() {
  const pageSize = 10;
  let currentPage = 1;
  const allBooks = [];

  while (true) {
    const {books, total} = await bookService.list({
      page: currentPage,
      limit: pageSize,
    });

    allBooks.push(...books);
    console.log(`Loaded page ${currentPage}, total items: ${allBooks.length}/${total}`);

    if (allBooks.length >= total) {
      break;
    }

    currentPage++;
  }

  return allBooks;
}
