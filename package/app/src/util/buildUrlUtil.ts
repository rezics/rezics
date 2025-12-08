import type {UnitDTO} from '@package/contract';

export function buildUnitUrl(unit: UnitDTO): string {
  switch (unit.type) {
    case 'BOOK':
      return `/book/${unit.id}`;
    case 'REVIEW':
      return `/review/${unit.id}`;
    case 'QUOTE':
      return `/quote/${unit.id}`;
    case 'READLIST':
      return `/readlist/${unit.id}`;
    default:
      return `/unit/${unit.id}`;
  }
}
