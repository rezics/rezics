import type { UserDTO } from "@rezics/contract";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

type UserProfileState = {
  user: UserDTO | null;
  setUser: (user: UserDTO | null) => void;
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
