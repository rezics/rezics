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
};

const prisma = new PrismaClient();

seedEchoKV(prisma);
