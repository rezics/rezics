import {api} from 'encore.dev/api';
import {prisma} from '../database-main/client';

type UserType = 'USER' | 'AUTHOR';

interface _User {
  id: string;
  email: string;
  slug: string;
  type: UserType;
  name: string;
  avatar: string | null;
  bio: string | null;
  joinDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserResponse {
  id: string;
  email: string;
  slug: string;
  type: UserType;
  name: string;
  avatar?: string;
  bio?: string;
  joinDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreateRequest {
  email: string;
  slug: string;
  passwordHash: string;
  type?: UserType;
  name: string;
  avatar?: string | null;
  bio?: string | null;
  joinDate?: string | Date | null;
}

interface UserUpdateRequest {
  email?: string;
  slug?: string;
  passwordHash?: string;
  type?: UserType;
  name?: string;
  avatar?: string | null;
  bio?: string | null;
  joinDate?: string | Date | null;
}

interface UserListResponse {
  users: UserResponse[];
}

function toUserResponse(u: _User): UserResponse {
  return {
    id: u.id,
    email: u.email,
    slug: u.slug,
    type: u.type,
    name: u.name,
    avatar: u.avatar ?? undefined,
    bio: u.bio ?? undefined,
    joinDate: u.joinDate ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export const list = api(
  {expose: true, method: 'GET', path: '/users'},
  async (): Promise<UserListResponse> => {
    const users = await prisma.user.findMany({orderBy: {createdAt: 'desc'}});
    return {users: users.map(toUserResponse)};
  },
);

export const get = api(
  {expose: true, method: 'GET', path: '/users/:id'},
  async ({id}: {id: string}): Promise<UserResponse> => {
    const u = await prisma.user.findUniqueOrThrow({where: {id}});
    return toUserResponse(u);
  },
);

export const getBySlug = api(
  {expose: true, method: 'GET', path: '/users/slug/:slug'},
  async ({slug}: {slug: string}): Promise<UserResponse> => {
    const u = await prisma.user.findUniqueOrThrow({where: {slug}});
    return toUserResponse(u);
  },
);

export const create = api(
  {expose: true, method: 'POST', path: '/users'},
  async (req: UserCreateRequest): Promise<UserResponse> => {
    const {email, slug, passwordHash, type, name, avatar, bio, joinDate} = req;
    const u = await prisma.user.create({
      data: {
        email,
        slug,
        passwordHash,
        type: type ?? 'USER',
        name,
        avatar: avatar ?? null,
        bio: bio ?? null,
        joinDate: joinDate ? new Date(joinDate) : null,
      },
    });
    return toUserResponse(u);
  },
);

export const update = api(
  {expose: true, method: 'PUT', path: '/users/:id'},
  async ({
    id,
    ...req
  }: {id: string} & UserUpdateRequest): Promise<UserResponse> => {
    const {email, slug, passwordHash, type, name, avatar, bio, joinDate} = req;
    const u = await prisma.user.update({
      where: {id},
      data: {
        email: email ?? undefined,
        slug: slug ?? undefined,
        passwordHash: passwordHash ?? undefined,
        type: type ?? undefined,
        name: name ?? undefined,
        avatar: avatar ?? undefined,
        bio: bio ?? undefined,
        joinDate:
          joinDate === undefined
            ? undefined
            : joinDate
            ? new Date(joinDate)
            : null,
      },
    });
    return toUserResponse(u);
  },
);

export const remove = api(
  {expose: true, method: 'DELETE', path: '/users/:id'},
  async ({id}: {id: string}): Promise<{message: string}> => {
    await prisma.user.delete({where: {id}});
    return {message: 'User deleted successfully'};
  },
);
