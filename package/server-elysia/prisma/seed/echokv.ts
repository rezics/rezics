// 添加 main tag group 以及 公告板
import {PrismaClient} from '../generated/client';

import {noticeboard} from './data/home/noticeboard';

export const seedEchoKV = async (prisma: PrismaClient) => {
  await prisma.echoKV.create({
    data: {
      key: 'home_notice',
      value: JSON.stringify(noticeboard),
    },
  });
  await prisma.echoKV.create({
    data: {
      key: 'book_search_tag_group_quick',
      value: JSON.stringify({
        presetTags: ['fiction', 'nonfiction', 'mystery', 'romance'],
      }),
    },
  });
};

const prisma = new PrismaClient();

seedEchoKV(prisma);
