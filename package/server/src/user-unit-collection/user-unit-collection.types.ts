import type { UserUnitCollection } from "#/prisma/client";

export type UserUnitCollectionRow = UserUnitCollection;

export type CollectionUnitRow = {
  userId: string;
  unitId: string;
  shelfIds: string[];
  tagUnitIds: string[];
  searchText: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};
