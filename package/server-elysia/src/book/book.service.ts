import {prisma} from '@/prisma/client';
import {UnitStatus, UnitType} from '@/prisma/client';
import type {Prisma, Rating} from '@/prisma/client';
import type {BookWithRelations} from './types';
import {bookInclude} from './types';
import type {
  BookListQuery,
  UpdateBookInput,
  CreateBookInput,
} from '@package/contract';
import {syncBookToMeili, deleteBookFromMeili} from '@/src/meili/book/sync';
import {getBookApproxCount} from './sql';

/**
 * Book Service - Business logic layer
 */
export class BookService {
  /**
   * Build where clause for book queries
   */
  private buildWhereClause(options: BookListQuery): Prisma.BookWhereInput {
    const andWhere: Prisma.BookWhereInput[] = [];

    // NSFW filter - by default, only return non-NSFW content
    // If options.nsfw === true, only return NSFW content
    if (options.nsfw === true) {
      andWhere.push({unit: {nsfw: true}});
    } else {
      andWhere.push({unit: {nsfw: false}});
    }

    // Search in title, isbn, or post title
    if (options.q && options.q.trim()) {
      andWhere.push({
        OR: [
          {title: {contains: options.q, mode: 'insensitive'}},
          {isbn: {contains: options.q, mode: 'insensitive'}},
          // {unit: {title: {contains: options.q, mode: 'insensitive'}}},
          {author: {some: {name: {contains: options.q, mode: 'insensitive'}}}},
          {press: {some: {name: {contains: options.q, mode: 'insensitive'}}}},
          {
            producer: {
              some: {name: {contains: options.q, mode: 'insensitive'}},
            },
          },
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
        author: {
          some: {unitId: {in: authorList}},
        },
      });
    }

    // Filter by press IDs
    const pressList = (options.pressIds ?? options.pressId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (pressList.length > 0) {
      andWhere.push({press: {some: {unitId: {in: pressList}}}});
    }

    // Filter by producer IDs
    const producerList = (options.producerIds ?? options.producerId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (producerList.length > 0) {
      andWhere.push({producer: {some: {unitId: {in: producerList}}}});
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

    return {AND: andWhere};
  }

  /**
   * List books with filters and pagination
   */
  async list(options: BookListQuery = {}): Promise<{
    books: BookWithRelations[];
    total: number;
  }> {
    const cursor = options.cursor;
    const hasCursor = cursor?.unitId && cursor?.createdAt;
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const calculateSkip = () => {
      if (hasCursor) {
        return 1;
      }
      return options.start ?? 0;
    };
    const skipNum = calculateSkip();
    const where = this.buildWhereClause(options);
    console.log('cursor', cursor);
    // TODO use Postgres Approximate counting
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: {createdAt: 'desc'},
        skip: skipNum,
        cursor: hasCursor
          ? {unitId: cursor.unitId, createdAt: cursor.createdAt}
          : undefined,
        take: limitNum,
        include: bookInclude,
      }),
      // prisma.book.count({where}),
      getBookApproxCount(),
    ]);

    return {books: books as BookWithRelations[], total: total};
  }

  /**
   * Get book by unitId
   */
  async getByUnitId(unitId: string): Promise<BookWithRelations> {
    // const unit = await prisma.unit.findUniqueOrThrow({where: {id: unitId}});
    const book = await prisma.book.findUniqueOrThrow({
      where: {unitId: unitId},
      include: bookInclude,
    });

    return book as BookWithRelations;
  }

  /**
   * Get rating by book unitId
   */
  async getRatingByBookUnitId(unitId: string): Promise<Rating> {
    const rating = await prisma.rating.findUniqueOrThrow({
      where: {unitId_domain: {unitId: unitId, domain: unitId}},
    });
    return rating;
  }

  /**
   * Get chapterIndex by bookUnitId
   */
  async getChapterIndexByBookUnitId(bookUnitId: string): Promise<any> {
    const chapterIndex = await prisma.bookIndex.findUniqueOrThrow({
      where: {bookUnitId},
    });
    return chapterIndex;
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
    const {
      userId,
      title,
      authorIds,
      coverUrl,
      isbn,
      textLength,
      chaptersIndex,
      extra,
      nsfw,
    } = req;

    const book = await prisma.book.create({
      data: {
        unit: {
          create: {
            userId: userId || '',
            type: UnitType.BOOK,
            status: UnitStatus.ACTIVE,
            title,
            nsfw: nsfw || false,
            metadata: (extra ?? {}) as Prisma.InputJsonValue,
          },
        },
        title,
        author:
          authorIds && authorIds.length > 0
            ? {connect: authorIds.map((unitId: string) => ({unitId}))}
            : undefined,
        coverUrl: coverUrl || undefined,
        textLength: parseInt(textLength || '0') || 0,
        isbn: isbn || undefined,
        chapterIndex: {
          create: {index: chaptersIndex || ({} as Prisma.InputJsonValue)},
        },
        extra: (extra ?? null) as Prisma.InputJsonValue,
      },
      include: bookInclude,
    });

    await syncBookToMeili(book.unitId);

    return book as BookWithRelations;
  }

  /**
   * Update book
   */
  async update(
    unitId: string,
    req: UpdateBookInput,
  ): Promise<BookWithRelations> {
    const {
      title,
      authorIds,
      pressIds,
      producerIds,
      coverUrl,
      isbn,
      textLength,
      chaptersIndex,
      extra,
      description,
      nsfw,
    } = req;

    const book = await prisma.book.update({
      where: {unitId},
      data: {
        title: title || undefined,
        author: Array.isArray(authorIds)
          ? {set: authorIds.map(unitId => ({unitId}))}
          : undefined,
        press: Array.isArray(pressIds)
          ? {set: pressIds.map(unitId => ({unitId}))}
          : undefined,
        producer: Array.isArray(producerIds)
          ? {set: producerIds.map(unitId => ({unitId}))}
          : undefined,
        coverUrl: coverUrl || undefined,
        isbn: isbn || undefined,
        textLength: Number(textLength || '0') || 0,
        chapterIndex: {
          update: {index: chaptersIndex || undefined},
        },
        description: description || undefined,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
        unit: {
          update: {
            title: title || undefined,
            metadata: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
            nsfw: nsfw || false,
          },
        },
      },
      include: bookInclude,
    });

    await syncBookToMeili(unitId);

    return book as BookWithRelations;
  }

  async updateChapterIndex(
    unitId: string,
    chaptersIndex: Prisma.InputJsonValue,
  ): Promise<Prisma.InputJsonValue> {
    const chapterIndex = await prisma.bookIndex.update({
      where: {bookUnitId: unitId},
      data: {index: chaptersIndex || undefined},
    });
    return chapterIndex;
  }

  /**
   * Delete book by unitId
   */
  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}});
    await deleteBookFromMeili(unitId);
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
      where: {author: {some: {unitId: userId}}},
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
        author: {
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
