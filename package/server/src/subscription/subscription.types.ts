import type { Prisma } from "#/prisma/client";

export const subscriptionInclude = {
  target: {
    select: {
      id: true,
      type: true,
      slug: true,
    },
  },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithTarget = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;
