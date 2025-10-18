import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { 
  list as listBooks, 
  get as getBook, 
  update as updateBook,
  create as createBook,
  // @ts-expect-error allow js
} from "~encore/internal/clients/books/endpoints_testing.js";
import { prisma } from "../database-main/client";
import type { CreateBookInput, UpdateBookInput, BookDTO } from "contract";

describe("books service", () => {
  let testUserId: string;
  let testAuthorId: string;
  let testBookPostId: string;

  // Setup test data before running tests
  beforeAll(async () => {
    // Create a test user for the book owner
    const testUser = await prisma.user.create({
      data: {
        name: "Test Book Owner",
        email: `test-book-owner-${Date.now()}@example.com`,
        slug: `test-book-owner-${Date.now()}`,
        passwordHash: "test-hash-not-used-in-tests",
      },
    });
    testUserId = testUser.id;

    // Create a test author
    const testAuthor = await prisma.user.create({
      data: {
        name: "Test Author",
        email: `test-author-${Date.now()}@example.com`,
        slug: `test-author-${Date.now()}`,
        passwordHash: "test-hash-not-used-in-tests",
      },
    });
    testAuthorId = testAuthor.id;

    // Create a test book
    const bookInput: CreateBookInput = {
      userId: testUserId,
      title: "Test Book for Integration Testing",
      authorIds: [testAuthorId],
      isbn: "978-0000000001",
      coverUrl: "https://example.com/test-cover.jpg",
      description: "A book created for testing purposes",
      chaptersIndex: JSON.stringify([
        { id: "1", title: "Chapter 1", page: 1 },
        { id: "2", title: "Chapter 2", page: 25 },
      ]),
      extra: {
        testData: true,
        publisher: "Test Publisher",
      },
    };

    const createdBook = await createBook(bookInput);
    testBookPostId = createdBook.postId;
  });

  // Cleanup test data after all tests
  afterAll(async () => {
    // Clean up in reverse order of dependencies
    if (testBookPostId) {
      const book = await prisma.book.findFirst({
        where: { postId: testBookPostId },
      });
      
      if (book) {
        // Delete book-author relations
        await prisma.book.update({
          where: { postId: book.postId },
          data: { authors: { set: [] } },
        });
        
        // Delete the book
        await prisma.book.delete({
          where: { postId: book.postId },
        });
        
        // Delete the associated post
        await prisma.post.delete({
          where: { id: testBookPostId },
        });
      }
    }

    // Delete test users
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testAuthorId) {
      await prisma.user.delete({ where: { id: testAuthorId } }).catch(() => {});
    }
  });

  describe("list endpoint", () => {
    it("should return a list of books with pagination", async () => {
      const res = await listBooks({ 
        page: 1, 
        limit: 10 
      });

      expect(res).toBeTruthy();
      expect(Array.isArray(res.books)).toBe(true);
      expect(typeof res.total).toBe("number");
      expect(res.total).toBeGreaterThanOrEqual(0);
    });

    it("should filter books by search query", async () => {
      const res = await listBooks({ 
        q: "Test Book for Integration Testing",
        page: 1,
        limit: 10 
      });

      expect(res).toBeTruthy();
      expect(Array.isArray(res.books)).toBe(true);
      
      // Should find our test book
      const foundTestBook = res.books.find(
        (book: BookDTO) => book.postId === testBookPostId
      );
      expect(foundTestBook).toBeDefined();
      expect(foundTestBook?.title).toContain("Test Book");
    });

    it("should filter books by ISBN", async () => {
      const res = await listBooks({ 
        isbn: "978-0000000001",
        page: 1,
        limit: 10 
      });

      expect(res).toBeTruthy();
      expect(Array.isArray(res.books)).toBe(true);
      
      if (res.books.length > 0) {
        expect(res.books[0].isbn).toContain("978-0000000001");
      }
    });

    it("should filter books by author ID", async () => {
      const res = await listBooks({ 
        authorId: testAuthorId,
        page: 1,
        limit: 10 
      });

      expect(res).toBeTruthy();
      expect(Array.isArray(res.books)).toBe(true);
      
      // All books should have the test author
      res.books.forEach((book: BookDTO) => {
        const hasTestAuthor = book.authors?.some(
          (author: typeof book.authors[number]) => author?.id === testAuthorId
        );
        expect(hasTestAuthor).toBe(true);
      });
    });

    it("should filter books by user ID", async () => {
      const res = await listBooks({ 
        userId: testUserId,
        page: 1,
        limit: 10 
      });

      expect(res).toBeTruthy();
      expect(Array.isArray(res.books)).toBe(true);
      
      // All books should belong to the test user
      res.books.forEach((book: BookDTO) => {
        expect(book.userId).toBe(testUserId);
      });
    });

    it("should respect pagination limits", async () => {
      const res = await listBooks({ 
        page: 1, 
        limit: 5 
      });

      expect(res).toBeTruthy();
      expect(Array.isArray(res.books)).toBe(true);
      expect(res.books.length).toBeLessThanOrEqual(5);
    });
  });

  describe("get endpoint", () => {
    it("should retrieve a specific book by postId", async () => {
      const res = await getBook({ postId: testBookPostId });

      expect(res).toBeTruthy();
      expect(res.postId).toBe(testBookPostId);
      expect(res.title).toBe("Test Book for Integration Testing");
      expect(res.isbn).toBe("978-0000000001");
      expect(res.description).toBe("A book created for testing purposes");
    });

    it("should include book relations (user and authors)", async () => {
      const res = await getBook({ postId: testBookPostId });

      expect(res).toBeTruthy();
      expect(res.user).toBeDefined();
      expect(res.user?.id).toBe(testUserId);
      expect(res.user?.name).toBe("Test Book Owner");

      expect(Array.isArray(res.authors)).toBe(true);
      expect(res.authors?.length).toBeGreaterThan(0);
      expect(res.authors?.[0].id).toBe(testAuthorId);
      expect(res.authors?.[0].name).toBe("Test Author");
    });

    it("should include extra metadata", async () => {
      const res = await getBook({ postId: testBookPostId });

      expect(res).toBeTruthy();
      expect(res.extra).toBeDefined();
      expect(res.extra).toHaveProperty("testData", true);
      expect(res.extra).toHaveProperty("publisher", "Test Publisher");
    });

    it("should include timestamps", async () => {
      const res = await getBook({ postId: testBookPostId });

      expect(res).toBeTruthy();
      expect(res.createdAt).toBeDefined();
      expect(res.updatedAt).toBeDefined();
    });

    it("should throw error for non-existent book", async () => {
      await expect(
        getBook({ postId: "non-existent-post-id" })
      ).rejects.toThrow();
    });
  });

  describe("update endpoint", () => {
    it("should update book title", async () => {
      const updateData: UpdateBookInput = {
        title: "Updated Test Book Title",
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.postId).toBe(testBookPostId);
      expect(res.title).toBe("Updated Test Book Title");
    });

    it("should update book ISBN", async () => {
      const updateData: UpdateBookInput = {
        isbn: "978-0000000002",
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.isbn).toBe("978-0000000002");
    });

    it("should update book cover URL", async () => {
      const updateData: UpdateBookInput = {
        coverUrl: "https://example.com/updated-cover.jpg",
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.coverUrl).toBe("https://example.com/updated-cover.jpg");
    });

    it("should update book description", async () => {
      const updateData: UpdateBookInput = {
        description: "Updated description for testing",
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.description).toBe("Updated description for testing");
    });

    it("should update book chapters index", async () => {
      const newChapters = JSON.stringify([
        { id: "1", title: "Updated Chapter 1", page: 1 },
        { id: "2", title: "Updated Chapter 2", page: 30 },
        { id: "3", title: "New Chapter 3", page: 60 },
      ]);

      const updateData: UpdateBookInput = {
        chaptersIndex: newChapters,
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.chaptersIndex).toBe(newChapters);
    });

    it("should update book extra metadata", async () => {
      const updateData: UpdateBookInput = {
        extra: {
          testData: true,
          publisher: "Updated Publisher",
          edition: "Second Edition",
          year: 2024,
        },
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.extra).toBeDefined();
      expect(res.extra).toHaveProperty("publisher", "Updated Publisher");
      expect(res.extra).toHaveProperty("edition", "Second Edition");
      expect(res.extra).toHaveProperty("year", 2024);
    });

    it("should update multiple fields at once", async () => {
      const updateData: UpdateBookInput = {
        title: "Multi-field Update Test",
        isbn: "978-0000000003",
        description: "Testing multiple field updates",
        coverUrl: "https://example.com/multi-update.jpg",
      };

      const res = await updateBook({ 
        postId: testBookPostId, 
        ...updateData 
      });

      expect(res).toBeTruthy();
      expect(res.title).toBe("Multi-field Update Test");
      expect(res.isbn).toBe("978-0000000003");
      expect(res.description).toBe("Testing multiple field updates");
      expect(res.coverUrl).toBe("https://example.com/multi-update.jpg");
    });

    it("should throw error when updating non-existent book", async () => {
      const updateData: UpdateBookInput = {
        title: "This should fail",
      };

      await expect(
        updateBook({ 
          postId: "non-existent-post-id", 
          ...updateData 
        })
      ).rejects.toThrow();
    });
  });
});
