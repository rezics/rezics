import type { UserDTO } from "@rezics/contract";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

export type PartialUserDTO = Partial<UserDTO> & Record<string, unknown>;

type UserProfileState = {
  user: PartialUserDTO | null;
  setUser: (user: PartialUserDTO | null) => void;
  clearProfile: () => void;
};

export const USER_PROFILE_STORE_KEY = "user-profile";

export const useUserProfileStore = create<UserProfileState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        setUser: (user) => set({ user }),
        clearProfile: () => set({ user: null }),
      }),
      {
        name: USER_PROFILE_STORE_KEY,
        storage: createJSONStorage(() => localStorage),
      },
    ),
    { name: "userProfileStore", store: "userProfileStore" },
  ),
);
