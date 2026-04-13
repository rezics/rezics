import type {
  CreateReviewInput,
  ReviewListQuery,
  UpdateReviewInput,
} from "@rezics/contract";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { syncContentToMeili, deleteContentFromMeili } from "@/meili/content/sync";
import { unitService } from "@/unit/unit.service";
import { mapReviewQueryToUnitQuery } from "./mapper";
import type { ReviewWithRelations } from "./types";
import { reviewInclude } from "./types";

type UnitTypeOption = { unitType?: UnitType };

export class ReviewService {
  async list(
    options: ReviewListQuery = {},
    cfg?: UnitTypeOption,
  ): Promise<{
    reviews: ReviewWithRelations[];
    total: number;
  }> {
    const unitType = this.resolveUnitType(cfg?.unitType);
    const unitQuery = mapReviewQueryToUnitQuery(options, unitType);

    const { units, total } = await unitService.list(unitQuery, {
      include: reviewInclude,
    });

    return { reviews: units as ReviewWithRelations[], total };
  }

  async getById(
    id: string,
    cfg?: UnitTypeOption,
  ): Promise<ReviewWithRelations> {
    const _unitType = this.resolveUnitType(cfg?.unitType);
    const unit = await unitService.getByUnitId(id, { include: reviewInclude });
    return unit as ReviewWithRelations;
  }

  async create(
    req: CreateReviewInput,
    cfg?: UnitTypeOption,
  ): Promise<ReviewWithRelations> {
    const unitType = this.resolveUnitType(cfg?.unitType);

    const review = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          userId: req.userId,
          type: unitType,
          status: UnitStatus.ACTIVE,
          title: req.title ?? undefined,
          content: req.content,
          targetUnitId: req.bookId,
        },
        include: reviewInclude,
      });

      return unit as ReviewWithRelations;
    });

    await syncContentToMeili(review.id);

    return review;
  }

  async update(
    id: string,
    req: UpdateReviewInput,
    _cfg?: UnitTypeOption,
  ): Promise<ReviewWithRelations> {
    const review = await prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id },
        data: {
          content: req.content ?? undefined,
          title: req.title ?? undefined,
        },
        include: reviewInclude,
      });

      return updated as ReviewWithRelations;
    });

    await syncContentToMeili(id);

    return review;
  }

  async delete(id: string, cfg?: UnitTypeOption): Promise<void> {
    const _unitType = this.resolveUnitType(cfg?.unitType);
    await prisma.$transaction(async (tx) => {
      await unitService.delete(id, tx);
    });
    await deleteContentFromMeili(id);
  }

  private resolveUnitType(unitType?: UnitType): UnitType {
    return unitType ?? UnitType.REVIEW;
  }
}

export const reviewService = new ReviewService();
