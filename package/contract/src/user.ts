// User contracts
export type UserDTO = {
  id: string;
  email?: string;
  slug?: string;
  name: string;
  avatar?: string;
  bio?: string;
  joinDate?: string;
};

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  bio?: string;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, "password">> & { password?: string };
