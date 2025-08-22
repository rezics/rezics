import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
}

interface UserState {
	// 状态
	user: User | null;
	isAuthenticated: boolean;

	// Actions
	setUser: (user: User | null) => void;
	logout: () => void;
}

export const useUserStore = create<UserState>()(persist((set) => ({
	// 初始状态
	user: null,
	isAuthenticated: false,

	// Actions
	setUser: (user) =>
		set({
			user,
			isAuthenticated: !!user,
		}),

	logout: () =>
		set({
			user: null,
			isAuthenticated: false,
		}),
}), {
	name: "user-store",
	storage: createJSONStorage(() => localStorage),
}));
