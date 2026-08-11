"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export interface HeaderSearchDescriptor {
	readonly href: string;
	readonly label: string;
	readonly placeholder: string;
	readonly avatar?: PresentedAvatar | null;
	readonly avatarFallback: string;
}

interface RegisteredHeaderSearch {
	readonly token: symbol;
	readonly descriptor: HeaderSearchDescriptor;
}

interface HeaderSearchContextValue {
	readonly current?: HeaderSearchDescriptor;
	readonly register: (registration: RegisteredHeaderSearch) => void;
	readonly unregister: (token: symbol) => void;
}

const HeaderSearchContext = createContext<HeaderSearchContextValue | null>(null);

export function HeaderSearchProvider({ children }: { readonly children: ReactNode }) {
	const [registration, setRegistration] = useState<RegisteredHeaderSearch>();
	const register = useCallback((next: RegisteredHeaderSearch) => setRegistration(next), []);
	const unregister = useCallback(
		(token: symbol) =>
			setRegistration((current) => (current?.token === token ? undefined : current)),
		[],
	);
	const value = useMemo<HeaderSearchContextValue>(
		() => ({
			current: registration?.descriptor,
			register,
			unregister,
		}),
		[register, registration, unregister],
	);
	return <HeaderSearchContext.Provider value={value}>{children}</HeaderSearchContext.Provider>;
}

export function useCurrentHeaderSearch(): HeaderSearchDescriptor | undefined {
	const context = useContext(HeaderSearchContext);
	if (!context) throw new Error("useCurrentHeaderSearch must be used within HeaderSearchProvider");
	return context.current;
}

export function useHeaderSearchOverride(descriptor?: HeaderSearchDescriptor): void {
	const context = useContext(HeaderSearchContext);
	if (!context) throw new Error("useHeaderSearchOverride must be used within HeaderSearchProvider");
	const { register, unregister } = context;

	useEffect(() => {
		if (!descriptor) return;
		const token = Symbol("header-search");
		register({ token, descriptor });
		return () => unregister(token);
	}, [descriptor, register, unregister]);
}
