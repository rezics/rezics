// Types only used in server for Tag

import type {Prisma, Tag, Unit, User} from '#/prisma/client';

export type TagWithRelations = Tag & {
  unit: Unit & {user: User; domains: Unit[]};
};

export const tagInclude = {
  unit: {include: {user: true, domains: true}},
} satisfies Prisma.TagInclude;
