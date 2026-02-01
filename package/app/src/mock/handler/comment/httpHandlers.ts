import {http, HttpResponse} from 'msw';
import {mockUsers} from '../../data/reviews.ts';
import {toInt, toNonNegativeInt} from '../lib';

type CommentDTO = {
  id: string;
  rootPostId: string;
  parentCommentId?: string | null;
  depth: number;
  content?: string | null;
  created_at?: string;
  user?: {id: string; name: string; avatar?: string};
};

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const commentStore = new Map<string, CommentDTO[]>(); // rootPostId -> comments (flat)

function pickRandomUser() {
  return (
    mockUsers[Math.floor(Math.random() * mockUsers.length)] ?? {
      id: '1',
      name: 'John Doe',
      avatar: '',
    }
  );
}

function ensureSeedForRoot(rootPostId: string) {
  if (commentStore.has(rootPostId)) return;
  const now = Date.now();
  const items: CommentDTO[] = [];

  const topCount = 5;
  const topIds: string[] = [];
  for (let i = 0; i < topCount; i++) {
    const id = genId();
    topIds.push(id);
    items.push({
      id,
      rootPostId,
      parentCommentId: null,
      depth: 1,
      content: `Top comment ${i + 1} for ${rootPostId}`,
      created_at: new Date(now - (i + 1) * 60_000).toISOString(),
      user: pickRandomUser(),
    });
  }

  for (const parentId of topIds) {
    const replyCount = Math.floor(Math.random() * 3);
    for (let j = 0; j < replyCount; j++) {
      const rid = genId();
      items.push({
        id: rid,
        rootPostId,
        parentCommentId: parentId,
        depth: 2,
        content: `Reply ${j + 1} to ${parentId}`,
        created_at: new Date(now - (topCount + j + 1) * 60_000).toISOString(),
        user: pickRandomUser(),
      });
      if (Math.random() < 0.4) {
        items.push({
          id: genId(),
          rootPostId,
          parentCommentId: rid,
          depth: 3,
          content: `Nested reply to ${rid}`,
          created_at: new Date(now - (topCount + j + 2) * 60_000).toISOString(),
          user: pickRandomUser(),
        });
      }
    }
  }

  commentStore.set(rootPostId, items);
}

function getAllComments(): CommentDTO[] {
  const all: CommentDTO[] = [];
  for (const list of commentStore.values()) all.push(...list);
  return all;
}

export const commentHttpHandlers = [
  // GET /api/comments?rootPostId=xxx -> CommentDTO[]
  http.get('/api/comments', ({request}) => {
    const url = new URL(request.url);
    const rootPostId = url.searchParams.get('rootPostId');
    if (!rootPostId) return HttpResponse.json([], {status: 200});
    ensureSeedForRoot(rootPostId);
    const items = commentStore.get(rootPostId) ?? [];
    return HttpResponse.json(items, {status: 200});
  }),

  // GET /api/comments/by-depth?rootPostId&depth&offset&limit -> OffsetPaginated<CommentDTO>
  http.get('/api/comments/by-depth', ({request}) => {
    const url = new URL(request.url);
    const rootPostId = url.searchParams.get('rootPostId');
    const depth = Number(url.searchParams.get('depth') ?? 1);
    const limit = toInt(url.searchParams.get('limit'), 10);
    const offset = toNonNegativeInt(url.searchParams.get('offset'), 0);
    if (!rootPostId)
      return HttpResponse.json(
        {items: [], offset: 0, totalItems: 0},
        {status: 200},
      );
    ensureSeedForRoot(rootPostId);
    const list = (commentStore.get(rootPostId) ?? []).filter(
      c => Number(c.depth) === Number(depth),
    );
    const totalItems = list.length;
    const items = list.slice(offset, offset + Math.max(1, limit));
    return HttpResponse.json({items, offset, totalItems}, {status: 200});
  }),

  // GET /api/comments/:id -> CommentDTO
  http.get('/api/comments/:id', ({params}) => {
    const id = String((params as any).id);
    const found = getAllComments().find(c => String(c.id) === id);
    if (!found) return HttpResponse.json({message: 'Not Found'}, {status: 404});
    return HttpResponse.json(found, {status: 200});
  }),
];
