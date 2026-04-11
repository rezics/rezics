import type {
  CreateReviewInput,
  ReviewListQuery,
  UpdateReviewInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { syncContentToMeili, deleteContentFromMeili } from "@/meili/content/sync";
import { unitService } from "@/unit/unit.service";
import {
  buildMetadataWithRating,
  buildRatingWhereClause,
  extractRatingFromMetadata,
  mapReviewQueryToUnitQuery,
  normalizeRatingValue,
} from "./mapper";
import type { ReviewWithRelations } from "./types";
import { reviewInclude } from "./types";

type UnitTypeOption = { unitType?: UnitType };

export class ReviewService {
  /**
   * 列表查询 Review。
   *
   * - 会自动根据 `ReviewListQuery` 组装底层 Unit 查询
   * - 可通过 cfg.unitType 复用到其它 UnitType 的 Review 语义
   */
  async list(
    options: ReviewListQuery = {},
    cfg?: UnitTypeOption,
  ): Promise<{
    reviews: ReviewWithRelations[];
    total: number;
  }> {
    const unitType = this.resolveUnitType(cfg?.unitType);
    const unitQuery = mapReviewQueryToUnitQuery(options, unitType);
    const ratingWhere = buildRatingWhereClause(options);

    const { units, total } = await unitService.list(unitQuery, {
      include: reviewInclude,
      where: ratingWhere,
    });

    return { reviews: units as ReviewWithRelations[], total };
  }

  /**
   * 根据 id 获取单个 Review。
   *
   * - 同时校验 Unit 的 type 是否为期望的 Review 类型
   */
  async getById(
    id: string,
    cfg?: UnitTypeOption,
  ): Promise<ReviewWithRelations> {
    const _unitType = this.resolveUnitType(cfg?.unitType);
    const unit = await unitService.getByUnitId(id, { include: reviewInclude });
    return unit as ReviewWithRelations;
  }

  /**
   * 创建 Review。
   *
   * - 会写入 Unit、附带 metadata.rating
   * - 若提供 rating，则同时更新对应图书的聚合评分
   */
  async create(
    req: CreateReviewInput,
    cfg?: UnitTypeOption,
  ): Promise<ReviewWithRelations> {
    const unitType = this.resolveUnitType(cfg?.unitType);
    const normalizedRating = normalizeRatingValue(req.rating);

    const review = await prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          userId: req.userId,
          type: unitType,
          status: UnitStatus.ACTIVE,
          title: req.title ?? undefined,
          content: req.content,
          targetUnitId: req.bookId,
          metadata:
            normalizedRating !== undefined
              ? (buildMetadataWithRating(
                  normalizedRating,
                ) as Prisma.InputJsonValue)
              : undefined,
        },
        include: reviewInclude,
      });

      if (normalizedRating !== undefined && req.bookId) {
        await this.applyRatingDelta(tx, req.bookId, normalizedRating, 1);
      }

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
    const ratingProvided = Object.hasOwn(req, "rating");
    const normalizedRating =
      ratingProvided && typeof req.rating === "number"
        ? normalizeRatingValue(req.rating)
        : undefined;

    const review = await prisma.$transaction(async (tx) => {
      const existing = await tx.unit.findUniqueOrThrow({
        where: { id },
        select: { metadata: true, targetUnitId: true, type: true },
      });

      const currentRating = extractRatingFromMetadata(existing.metadata);
      const metadataUpdate =
        ratingProvided && normalizedRating !== undefined
          ? (buildMetadataWithRating(
              normalizedRating,
              existing.metadata,
            ) as Prisma.InputJsonValue)
          : undefined;

      const updated = await tx.unit.update({
        where: { id },
        data: {
          content: req.content ?? undefined,
          title: req.title ?? undefined,
          metadata: metadataUpdate,
        },
        include: reviewInclude,
      });

      if (
        ratingProvided &&
        normalizedRating !== undefined &&
        existing.targetUnitId
      ) {
        const deltaScore = normalizedRating - (currentRating ?? 0);
        const deltaCount = currentRating === undefined ? 1 : 0;
        if (deltaScore !== 0 || deltaCount !== 0) {
          await this.applyRatingDelta(
            tx,
            existing.targetUnitId,
            deltaScore,
            deltaCount,
          );
        }
      }

      return updated as ReviewWithRelations;
    });

    await syncContentToMeili(id);

    return review;
  }

  async delete(id: string, cfg?: UnitTypeOption): Promise<void> {
    const _unitType = this.resolveUnitType(cfg?.unitType);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.unit.findUniqueOrThrow({
        where: { id },
        select: { metadata: true, targetUnitId: true, type: true },
      });

      const currentRating = extractRatingFromMetadata(existing.metadata);
      await unitService.delete(id, tx);

      if (currentRating !== undefined && existing.targetUnitId) {
        await this.applyRatingDelta(
          tx,
          existing.targetUnitId,
          -currentRating,
          -1,
        );
      }
    });
    await deleteContentFromMeili(id);
  }

  private resolveUnitType(unitType?: UnitType): UnitType {
    return unitType ?? UnitType.REVIEW;
  }

  private async applyRatingDelta(
    tx: Prisma.TransactionClient,
    bookUnitId: string,
    deltaScore: number,
    deltaCount: number,
  ): Promise<void> {
    if (!bookUnitId || (deltaScore === 0 && deltaCount === 0)) return;
    const key = { unitId: bookUnitId, domain: bookUnitId };
    const existing = await tx.rating.findUnique({
      where: { unitId_domain: key },
    });

    if (!existing) {
      if (deltaCount <= 0) return;
      await tx.rating.create({
        data: {
          unitId: bookUnitId,
          domain: bookUnitId,
          totalScore: deltaScore,
          totalCount: deltaCount,
        },
      });
      return;
    }

    const nextScore = existing.totalScore + deltaScore;
    const nextCount = existing.totalCount + deltaCount;

    if (nextCount <= 0) {
      await tx.rating.delete({ where: { unitId_domain: key } });
      return;
    }

    await tx.rating.update({
      where: { unitId_domain: key },
      data: {
        totalScore: nextScore,
        totalCount: nextCount,
      },
    });
  }
}

export const reviewService = new ReviewService();
