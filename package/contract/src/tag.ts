// Tag contracts
export type TagDTO = {
  id: string;
  name: string;
  type?: string;
};

export type CreateTagInput = {
  name: string;
  type?: string | null;
};

export type UpdateTagInput = Partial<CreateTagInput>;
