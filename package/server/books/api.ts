import {api, Query} from 'encore.dev/api';
import type { BookListResponse, BookResponse, CreateBookInput, UpdateBookInput, PublicUser } from 'contract';
import {prisma} from '../database-main/client';
import type {Book, User, Post, Prisma} from '../database-main/client';
import {PostStatus, PostType} from '../database-main/client';

type BookCreateRequest = Required<Pick<CreateBookInput, 'userId' | 'title'>> & Omit<CreateBookInput, 'title' | 'userId'>;
type BookUpdateRequest = UpdateBookInput;

interface BookListParams {
  q?: Query<string>; // search in title/isbn
  tag?: Query<string>; // single tag
  tags?: Query<string>; // comma-separated list
  authorId?: Query<string>;
  authorIds?: Query<string>; // comma-separated list
  userId?: Query<string>;
  isbn?: Query<string>;
  page?: Query<number>; // 1-based
  limit?: Query<number>; // default 20
}

// Get all books
export const list = api(
  {expose: true, method: 'GET', path: '/books'},
  async (params: BookListParams): Promise<BookListResponse> => {
    const {
      q,
      tag,
      tags: tagsParam,
      authorId,
      authorIds: authorIdsParam,
      userId,
      isbn,
      page = 1,
      limit = 20,
    } = params;

    const pageNum = Math.max(Number(page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const tagList = (tagsParam ?? tag ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const authorList = (authorIdsParam ?? authorId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const andWhere: Prisma.BookWhereInput[] = [];

    if (q && q.trim()) {
      andWhere.push({
        OR: [
          {title: {contains: q, mode: 'insensitive'}},
          {isbn: {contains: q, mode: 'insensitive'}},
          {post: {title: {contains: q, mode: 'insensitive'}}},
        ],
      });
    }

    if (isbn && isbn.trim()) {
      andWhere.push({isbn: {contains: isbn, mode: 'insensitive'}});
    }

    if (userId && userId.trim()) {
      andWhere.push({post: {userId}});
    }

    if (authorList.length > 0) {
      andWhere.push({
        authors: {
          some: {id: {in: authorList}},
        },
      });
    }

    if (tagList.length > 0) {
      andWhere.push({
        post: {
          tags: {
            some: {name: {in: tagList}},
          },
        },
      });
    }

    const books = await prisma.book.findMany({
      where: andWhere.length > 0 ? {AND: andWhere} : undefined,
      orderBy: {createdAt: 'desc'},
      skip,
      take: limitNum,
      include: {post: {include: {user: true}}, authors: true},
    });

    const sanitizeUser = (u: User): PublicUser => ({
      id: u.id,
      slug: u.slug,
      name: u.name,
      avatar: u.avatar ?? (null as any), // keep field presence
    });

    return {
      books: books.map(
        (book: Book & {post: Post & {user: User}} & {authors: User[]}) => ({
          postId: book.postId,
          title: book.title,
          authors: book.authors.map(sanitizeUser),
          coverUrl: book.coverUrl || undefined,
          isbn: book.isbn || undefined,
          chaptersIndex: book.chaptersIndex || undefined,
          extra: book.extra as unknown,
          userId: book.post.userId,
          user: sanitizeUser(book.post.user),
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        }),
      ),
    };
  },
);

// Get book by postId
export const get = api(
  {expose: true, method: 'GET', path: '/books/:postId'},
  async ({postId}: {postId: string}): Promise<BookResponse> => {
    const book = await prisma.book.findUniqueOrThrow({
      where: {postId},
      include: {post: {include: {user: true}}, authors: true},
    });

    const sanitizeUser = (u: User): PublicUser => ({
      id: u.id,
      slug: u.slug,
      name: u.name,
      avatar: u.avatar ?? (null as any),
    });

    return {
      postId: book.postId,
      title: book.title,
      authors: book.authors.map(sanitizeUser),
      coverUrl: book.coverUrl || undefined,
      isbn: book.isbn || undefined,
      chaptersIndex: book.chaptersIndex || undefined,
      extra: book.extra as unknown,
      userId: book.post.userId,
      user: sanitizeUser(book.post.user),
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  },
);

// Create book
export const create = api(
  {expose: true, method: 'POST', path: '/books'},
  async (req: BookCreateRequest): Promise<BookResponse> => {
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
        // Keep extra duplicated into Book.extra for quick access; optional
        extra: (extra ?? null) as Prisma.InputJsonValue,
      },
      include: {post: {include: {user: true}}, authors: true},
    });

    const sanitizeUser = (u: User): PublicUser => ({
      id: u.id,
      slug: u.slug,
      name: u.name,
      avatar: u.avatar ?? (null as any),
    });

    return {
      postId: book.postId,
      title: book.title,
      authors: book.authors.map(sanitizeUser),
      coverUrl: book.coverUrl || undefined,
      isbn: book.isbn || undefined,
      chaptersIndex: book.chaptersIndex || undefined,
      extra: book.extra as unknown,
      userId: book.post.userId,
      user: sanitizeUser(book.post.user),
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  },
);

// Update book
export const update = api(
  {expose: true, method: 'PUT', path: '/books/:postId'},
  async ({
    postId,
    ...req
  }: {postId: string} & BookUpdateRequest): Promise<BookResponse> => {
    const {title, authorIds, coverUrl, isbn, chaptersIndex, extra} = req;

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
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
        post: {
          update: {
            title: title || undefined,
            metadata: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        },
      },
      include: {post: {include: {user: true}}, authors: true},
    });

    const sanitizeUser = (u: User): PublicUser => ({
      id: u.id,
      slug: u.slug,
      name: u.name,
      avatar: u.avatar,
    });

    return {
      postId: book.postId,
      title: book.title,
      authors: book.authors.map(sanitizeUser),
      coverUrl: book.coverUrl || undefined,
      isbn: book.isbn || undefined,
      chaptersIndex: book.chaptersIndex || undefined,
      extra: book.extra as unknown,
      userId: book.post.userId,
      user: sanitizeUser(book.post.user),
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  },
);

// Delete book
export const remove = api(
  {expose: true, method: 'DELETE', path: '/books/:postId'},
  async ({postId}: {postId: string}): Promise<{message: string}> => {
    await prisma.post.delete({where: {id: postId}});
    return {message: 'Book and related post deleted successfully'};
  },
);
