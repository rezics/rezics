import {PrismaClient} from '@package/server-elysia/prisma/generated/client';
import {addOrUpdateBooks, deleteAllBooks} from './documents';

const prisma = new PrismaClient();

// TODO 引入 cursor 进行 千万级批量操作

export async function syncAllBooks() {
  const books = await prisma.book.findMany({
    include: {
      author: true,
      press: true,
      producer: true,
      unit: {
        include: {
          tags: true,
        },
      },
    },
  });

  const formatted = books.map(b => ({
    id: b.unitId,
    // search fields
    title: b.title,
    coverUrl: b.coverUrl,
    description: b.description,
    isbn: b.isbn,
    tagSearch: b.unit.tags.map(t => t.name),
    authors: b.author.map(a => a.name),
    presses: b.press.map(p => p.name),
    producers: b.producer.map(p => p.name),
    nsfw: b.unit.nsfw,
    authorIds: b.author.map(a => a.unitId),
    pressIds: b.press.map(p => p.unitId),
    producerIds: b.producer.map(p => p.unitId),
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    // result fields
    unitId: b.unitId,
    author: b.author,
    press: b.press,
    producer: b.producer,
    tags: b.unit.tags,
  }));
  const deleteResult = await deleteAllBooks();
  const addResult = await addOrUpdateBooks(formatted);
  const result = {deleteResult, addResult};
  return {message: 'sync all books success', result};
}
