import {prisma, UnitStatus, UnitType} from '#/prisma/client';
import type {Prisma} from '#/prisma/client';
import type {TagWithRelations} from './types';
import {tagInclude} from './types';
import type {CreateTagInput, UpdateTagInput} from '@rezics/contract';

export type TagFilterOptions = {
  q?: string;
  type?: string | null;
  domainId?: string; // user unitId acting as domain
  objectId?: string; // target object unitId within
  page?: number;
  limit?: number;
};

export class TagService {
  private buildWhere(options: TagFilterOptions): Prisma.TagWhereInput {
    const and: Prisma.TagWhereInput[] = [];

    if (options.objectId) {
      and.push({units: {some: {id: options.objectId}}});
    }

    // if (options.q && options.q.trim()) {
    //   and.push({name: {contains: options.q, mode: 'insensitive'}});
    // }

    if (options.type) {
      and.push({type: options.type});
    }

    if (options.domainId) {
      and.push({unit: {domains: {some: {id: options.domainId}}}});
    }

    return and.length ? {AND: and} : {};
  }

  async list(options: TagFilterOptions = {}): Promise<{
    tags: TagWithRelations[];
    total: number;
  }> {
    const page = Math.max(Number(options.page ?? 1), 1);
    const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (page - 1) * limit;

    const where = this.buildWhere(options);

    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        where,
        orderBy: {createdAt: 'desc'},
        skip,
        take: limit,
        include: tagInclude,
      }),
      prisma.tag.count({where}),
    ]);

    return {tags: tags as TagWithRelations[], total};
  }

  async getByUnitId(unitId: string): Promise<TagWithRelations> {
    const tag = await prisma.tag.findUniqueOrThrow({
      where: {unitId},
      include: tagInclude,
    });
    return tag as TagWithRelations;
  }

  async getByNameInDomain(
    name: string,
    type: string | null | undefined,
    domainId: string,
  ): Promise<TagWithRelations | null> {
    const tag = await prisma.tag.findFirst({
      where: {
        name,
        type: type ?? undefined,
        unit: {domains: {some: {id: domainId}}},
      },
      include: tagInclude,
    });
    return (tag ?? null) as TagWithRelations | null;
  }

  async create(userId: string, req: CreateTagInput): Promise<TagWithRelations> {
    const {name, type, i18n, domains} = req;

    const tag = await prisma.tag.create({
      data: {
        unit: {
          create: {
            userId,
            type: UnitType.TAG,
            status: UnitStatus.ACTIVE,
            title: name,
            // domains: connect
            ...(Array.isArray(domains) && domains.length
              ? {domains: {connect: domains.map(id => ({id}))}}
              : {}),
          },
        },
        name,
        type: type ?? undefined,
        i18n: (i18n ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: tagInclude,
    });
    return tag as TagWithRelations;
  }

  async update(unitId: string, req: UpdateTagInput): Promise<TagWithRelations> {
    const {name, type, i18n, domains} = req;

    const tag = await prisma.tag.update({
      where: {unitId},
      data: {
        name: name ?? undefined,
        type: type ?? undefined,
        i18n: (i18n ?? undefined) as Prisma.InputJsonValue | undefined,
        unit: {
          update: {
            title: name ?? undefined,
            ...(Array.isArray(domains)
              ? {domains: {set: domains.map(id => ({id}))}}
              : {}),
          },
        },
      },
      include: tagInclude,
    });
    return tag as TagWithRelations;
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}});
  }

  async attachToUnit(tagUnitId: string, targetUnitId: string): Promise<void> {
    await prisma.unit.update({
      where: {id: targetUnitId},
      data: {tags: {connect: {unitId: tagUnitId}}},
    });
  }

  async detachFromUnit(tagUnitId: string, targetUnitId: string): Promise<void> {
    await prisma.unit.update({
      where: {id: targetUnitId},
      data: {tags: {disconnect: {unitId: tagUnitId}}},
    });
  }
}

export const tagService = new TagService();
