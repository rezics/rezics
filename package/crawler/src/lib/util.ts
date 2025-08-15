export const is_HTMLElement = (e: any) => e instanceof HTMLElement;

export const exec = <R>(f: () => R) => f();

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));
