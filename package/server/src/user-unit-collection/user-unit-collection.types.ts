import type { UserUnitCollection } from "../db/schema";

export type UserUnitCollectionRow = typeof UserUnitCollection.$inferSelect;

export type CollectionUnitRow = {
  userId: string;
  unitId: string;
  shelfIds: string[];
  tagUnitIds: string[];
  searchText: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};
