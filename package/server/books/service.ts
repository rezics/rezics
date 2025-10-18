import {prisma} from '../database-main/client';
import {PostStatus, PostType} from '../database-main/client';
import type {Prisma} from '../database-main/client';
import type {BookFilterOptions, BookWithRelations} from './types';
import {bookInclude} from './types';
import {validateCreateBook, validateUpdateBook} from './validation';
import type {UpdateBookInput, CreateBookInput} from 'contract';

import {getBookApproxCount} from './sql';

/**
 * Book Service - Business logic layer
 */
export class BookService {
  /**
   * Build where clause for book queries
   */
  private buildWhereClause(options: BookFilterOptions): Prisma.BookWhereInput {
    const andWhere: Prisma.BookWhereInput[] = [];

    // Search in title, isbn, or post title
    if (options.q && options.q.trim()) {
      andWhere.push({
        OR: [
          {title: {contains: options.q, mode: 'insensitive'}},
          {isbn: {contains: options.q, mode: 'insensitive'}},
          {post: {title: {contains: options.q, mode: 'insensitive'}}},
        ],
      });
    }

    // Filter by ISBN
    if (options.isbn && options.isbn.trim()) {
      andWhere.push({isbn: {contains: options.isbn, mode: 'insensitive'}});
    }

    // Filter by user ID
    if (options.userId && options.userId.trim()) {
      andWhere.push({post: {userId: options.userId}});
    }

    // Filter by author IDs
    const authorList = (options.authorIds ?? options.authorId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (authorList.length > 0) {
      andWhere.push({
        authors: {
          some: {id: {in: authorList}},
        },
      });
    }

    // Filter by tags
    const tagList = (options.tags ?? options.tag ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      andWhere.push({
        post: {
          tags: {
            some: {name: {in: tagList}},
          },
        },
      });
    }

    return andWhere.length > 0 ? {AND: andWhere} : {};
  }

  /**
   * List books with filters and pagination
   */
  async list(options: BookFilterOptions = {}): Promise<{
    books: BookWithRelations[];
    total: number;
  }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const where = this.buildWhereClause(options);

    // TODO use Postgres Approximate counting
    const timeStart = Date.now();
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: {createdAt: 'desc'},
        skip,
        take: limitNum,
        include: bookInclude,
      }),
      getBookApproxCount(),
    ]);
    const timeEnd = Date.now();

    console.log(`time: ${timeEnd - timeStart}ms, ${timeStart}, ${timeEnd}`);

    return {books: books as BookWithRelations[], total};
  }

  /**
   * Get book by postId
   */
  async getByPostId(postId: string): Promise<BookWithRelations> {
    const book = await prisma.book.findUniqueOrThrow({
      where: {postId},
      include: bookInclude,
    });

    return book as BookWithRelations;
  }

  /**
   * Get book by ISBN
   */
  async getByIsbn(isbn: string): Promise<BookWithRelations | null> {
    const book = await prisma.book.findFirst({
      where: {isbn},
      include: bookInclude,
    });

    return book as BookWithRelations | null;
  }

  /**
   * Create new book
   */
  async create(req: CreateBookInput): Promise<BookWithRelations> {
    validateCreateBook(req);

    const {userId, title, authorIds, coverUrl, isbn, chaptersIndex, extra} =
      req;

    const book = await prisma.book.create({
      data: {
        post: {
          create: {
            userId,
            type: PostType.BOOK,
            status: PostStatus.ACTIVE,
            title,
            metadata: (extra ?? {}) as Prisma.InputJsonValue,
          },
        },
        title,
        authors:
          authorIds && authorIds.length > 0
            ? {connect: authorIds.map(id => ({id}))}
            : undefined,
        coverUrl: coverUrl || undefined,
        isbn: isbn || undefined,
        chaptersIndex: chaptersIndex || undefined,
        extra: (extra ?? null) as Prisma.InputJsonValue,
      },
      include: bookInclude,
    });

    return book as BookWithRelations;
  }

  /**
   * Update book
   */
  async update(
    postId: string,
    req: UpdateBookInput,
  ): Promise<BookWithRelations> {
    validateUpdateBook(req);

    const {
      title,
      authorIds,
      coverUrl,
      isbn,
      chaptersIndex,
      extra,
      description,
    } = req;

    const book = await prisma.book.update({
      where: {postId},
      data: {
        title: title || undefined,
        authors: Array.isArray(authorIds)
          ? {set: authorIds.map(id => ({id}))}
          : undefined,
        coverUrl: coverUrl || undefined,
        isbn: isbn || undefined,
        chaptersIndex: chaptersIndex || undefined,
        description: description || undefined,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
        post: {
          update: {
            title: title || undefined,
            metadata: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        },
      },
      include: bookInclude,
    });

    return book as BookWithRelations;
  }

  /**
   * Delete book by postId
   */
  async delete(postId: string): Promise<void> {
    await prisma.post.delete({where: {id: postId}});
  }

  /**
   * Check if book exists by postId
   */
  async exists(postId: string): Promise<boolean> {
    const count = await prisma.book.count({where: {postId}});
    return count > 0;
  }

  /**
   * Get books by user ID
   */
  async getByUserId(userId: string): Promise<BookWithRelations[]> {
    const books = await prisma.book.findMany({
      where: {post: {userId}},
      orderBy: {createdAt: 'desc'},
      include: bookInclude,
    });

    return books as BookWithRelations[];
  }

  /**
   * Get books by author ID
   */
  async getByAuthorId(authorId: string): Promise<BookWithRelations[]> {
    const books = await prisma.book.findMany({
      where: {
        authors: {
          some: {id: authorId},
        },
      },
      orderBy: {createdAt: 'desc'},
      include: bookInclude,
    });

    return books as BookWithRelations[];
  }
}

// Export singleton instance
export const bookService = new BookService();
