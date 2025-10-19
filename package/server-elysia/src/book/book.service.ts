import {prisma} from '@/prisma/client';
import {UnitStatus, UnitType} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import type {BookFilterOptions, BookWithRelations} from './types';
import {bookInclude} from './types';
import {validateCreateBook, validateUpdateBook} from './validation.ts';
import type {UpdateBookInput, CreateBookInput} from '@package/contract';

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
          {unit: {title: {contains: options.q, mode: 'insensitive'}}},
        ],
      });
    }

    // Filter by ISBN
    if (options.isbn && options.isbn.trim()) {
      andWhere.push({isbn: {contains: options.isbn, mode: 'insensitive'}});
    }

    // Filter by user ID
    if (options.userId && options.userId.trim()) {
      andWhere.push({unit: {userId: options.userId}});
    }

    // Filter by author IDs
    const authorList = (options.authorIds ?? options.authorId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (authorList.length > 0) {
      andWhere.push({
        authors: {
          some: {unitId: {in: authorList}},
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
        unit: {
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

    return {books: books as BookWithRelations[], total};
  }

  /**
   * Get book by postId
   */
  async getByUnitId(unitId: string): Promise<BookWithRelations> {
    const unit = await prisma.unit.findUniqueOrThrow({where: {id: unitId}});
    const book = await prisma.book.findUniqueOrThrow({
      where: {unitId: unit.id},
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
        unit: {
          create: {
            userId,
            type: UnitType.BOOK,
            status: UnitStatus.ACTIVE,
            title,
            metadata: (extra ?? {}) as Prisma.InputJsonValue,
          },
        },
        title,
        authors:
          authorIds && authorIds.length > 0
            ? {connect: authorIds.map((unitId: string) => ({unitId}))}
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
    unitId: string,
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
      where: {unitId},
      data: {
        title: title || undefined,
        authors: Array.isArray(authorIds)
          ? {set: authorIds.map(unitId => ({unitId}))}
          : undefined,
        coverUrl: coverUrl || undefined,
        isbn: isbn || undefined,
        chaptersIndex: chaptersIndex || undefined,
        description: description || undefined,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
        unit: {
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
   * Delete book by unitId
   */
  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}});
  }

  /**
   * Check if book exists by unitId
   */
  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.book.count({where: {unitId}});
    return count > 0;
  }

  /**
   * Get books by user ID
   */
  async getByUserId(userId: string): Promise<BookWithRelations[]> {
    const books = await prisma.book.findMany({
      where: {authors: {some: {unitId: userId}}},
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
          some: {unitId: authorId},
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
