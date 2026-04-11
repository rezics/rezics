import type {
  CreateReadlistInput,
  ReadlistDTO,
  ReadlistListQuery,
  UpdateReadlistInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { syncContentToMeili, deleteContentFromMeili } from "@/meili/content/sync";
import { mapReadlistListRowToDTO, mapReadlistRowToDTO } from "./mapper";
import { readlistListSelect, readlistSelect } from "./types";

export class ReadlistService {
  private buildWhere(options: ReadlistListQuery): Prisma.ReadListWhereInput {
    const and: Prisma.ReadListWhereInput[] = [
      { unit: { status: UnitStatus.ACTIVE, type: UnitType.READLIST } },
    ];

    if (options.q?.trim()) {
      and.push({
        unit: { title: { contains: options.q, mode: "insensitive" } },
      });
    }

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    const tagList = (options.tags ?? options.tag ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      and.push({ unit: { tags: { some: { name: { in: tagList } } } } });
    }

    if (options.hasBookUnitId) {
      and.push({ book: { some: { unitId: options.hasBookUnitId } } });
    }
    if (options.hasReviewUnitId) {
      and.push({ review: { some: { id: options.hasReviewUnitId } } });
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    options: ReadlistListQuery,
  ): Prisma.Enumerable<Prisma.ReadListOrderByWithRelationInput> {
    const order = (options.sort?.order ?? "desc") as "asc" | "desc";
    const type = options.sort?.type ?? "createdAt";
    if (type === "likeCount")
      return [{ unit: { createdAt: "desc" } }, { unitId: "desc" }];
    if (type === "commentCount")
      return [{ unit: { createdAt: "desc" } }, { unitId: "desc" }];
    if (type === "viewCount")
      return [{ unit: { createdAt: "desc" } }, { unitId: "desc" }];
    if (type === "updatedAt")
      return [{ unit: { updatedAt: order } }, { unitId: "desc" }];
    if (type === "publishedAt")
      return [{ unit: { publishedAt: order } }, { unitId: "desc" }];
    return [{ unit: { createdAt: order } }, { unitId: "desc" }];
  }

  // Mapping moved to mapper.ts

  async list(
    options: ReadlistListQuery = {},
  ): Promise<{ readlists: ReadlistDTO[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const hasCursor = Boolean(options.cursor?.id);
    const skipNum = hasCursor ? 1 : (options.start ?? 0);
    const where = this.buildWhere(options);
    const orderBy = this.buildOrderBy(options);

    const [rows, total] = await Promise.all([
      prisma.readList.findMany({
        where,
        orderBy,
        skip: skipNum,
        cursor: hasCursor ? { unitId: options.cursor!.id! } : undefined,
        take: limitNum,
        select: readlistListSelect,
      }),
      prisma.readList.count({ where }),
    ]);

    return { readlists: rows.map((r) => mapReadlistListRowToDTO(r)), total };
  }

  async getByUnitId(unitId: string): Promise<ReadlistDTO> {
    const row = await prisma.readList.findFirstOrThrow({
      where: { unitId },
      select: readlistSelect,
    });
    return mapReadlistRowToDTO(row);
  }

  async create(req: CreateReadlistInput, userId: string): Promise<ReadlistDTO> {
    const { book, review, order, title, content, coverUrl } = req;

    // Create Unit first (1:1 with ReadList)
    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.READLIST,
        status: UnitStatus.ACTIVE,
        title,
        metadata: { coverUrl: coverUrl || undefined } as Prisma.InputJsonValue,
      },
    });
    const row = await prisma.readList.create({
      data: {
        unitId: unit.id,
        book: { connect: book!.map((unitId) => ({ unitId })) },
        review: { connect: review!.map((id) => ({ id })) },
        order,
      },
      select: readlistSelect,
    });

    await syncContentToMeili(unit.id);
    await syncContentToMeili(unit.id);

    return mapReadlistRowToDTO(row);
  }

  async update(unitId: string, req: UpdateReadlistInput): Promise<ReadlistDTO> {
    const { book, review, order, title, content, coverUrl } = req;
    const row = await prisma.readList.update({
      where: { unitId },
      data: {
        unit: {
          update: {
            title: title || undefined,
            content: content || undefined,
            metadata: {
              coverUrl: coverUrl || undefined,
            } as Prisma.InputJsonValue,
          },
        },
        book: { connect: book!.map((unitId) => ({ unitId })) },
        review: { connect: review!.map((id) => ({ id })) },
        order,
      },
      select: readlistSelect,
    });
    await syncContentToMeili(unitId);
    await syncContentToMeili(unitId);
    return mapReadlistRowToDTO(row);
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
    await deleteContentFromMeili(unitId);
    await deleteContentFromMeili(unitId);
  }
}

export const readlistService = new ReadlistService();
