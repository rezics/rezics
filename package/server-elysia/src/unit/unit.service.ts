import {prisma} from '@/prisma/client';
import type {Unit, User} from '@/prisma/client';

export class UnitService {
  async getByUnitId(unitId: string): Promise<Unit> {
    const unit = await prisma.unit.findUniqueOrThrow({where: {id: unitId}});
    return unit as Unit;
  }
}

export const unitService = new UnitService();
