export type UserUnitCollectionRow = {
  userId: string;
  unitId: string;
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CollectionUnitRow = {
  userId: string;
  unitId: string;
  shelfIds: string[];
  tagUnitIds: string[];
  searchText: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};
