// Readlist contracts
export type ReadlistDTO = {
  id: string;
  title: string;
  coverUrl?: string;
  creator?: { id?: string; name: string; avatar?: string };
  likes?: number;
};

export type CreateReadlistInput = {
  title: string;
  coverUrl?: string;
  bookIds?: string[];
};

export type UpdateReadlistInput = Partial<CreateReadlistInput>;
