// MOCK: Storybook user fixtures, hand-authored against `PublicUser`.
import type { PublicUser } from "@rezics/contract";

export const userAlice: PublicUser = {
  unitId: "user-alice",
  name: "Alice Mei",
  avatar: "https://i.pravatar.cc/96?img=47",
  bio: "Editor of bookish journals; prefers 19th-century Russian novels and short stories.",
  followersCount: 1284,
  followingsCount: 312,
};

export const userBen: PublicUser = {
  unitId: "user-ben",
  name: "Ben Zhao",
  avatar: "https://i.pravatar.cc/96?img=12",
  bio: "Translator and reader, slow to recommend but loyal to favourites.",
  followersCount: 422,
  followingsCount: 198,
};

export const userCora: PublicUser = {
  unitId: "user-cora",
  name: "Cora Lim",
  avatar: "https://i.pravatar.cc/96?img=21",
  bio: "Speculative fiction librarian.",
  followersCount: 89,
  followingsCount: 41,
};

export const userAnonymous: PublicUser = {
  unitId: "user-anon",
  name: "Anonymous",
  avatar: null,
};

export const userList: PublicUser[] = [userAlice, userBen, userCora];
