import type {Prisma, CommentIndex, Unit, User} from '#/prisma/client';

// Internal comment type with relations
export type CommentWithRelations = CommentIndex & {
  unit: Unit & {user: User};
};

// Prisma include for comment relations
export const commentInclude = {
  unit: {include: {user: true}},
} satisfies Prisma.CommentIndexInclude;
