export type UserShelfItemMetadataRow = {
  userId: string;
  unitId: string;
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserShelfItemRow = {
  userId: string;
  unitId: string;
  shelfIds: string[];
  tagUnitIds: string[];
  searchText: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};
