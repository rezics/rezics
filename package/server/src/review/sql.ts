import {prisma, UnitType} from '#/prisma/client';

/**
 * Get approximate/fast count of reviews
 * For now, use exact count filtered by type.
 */
export async function getReviewApproxCount() {
  const total = await prisma.unit.count({where: {type: UnitType.REVIEW}});
  return total;
}
