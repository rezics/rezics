"use client";

import type { UiLocale } from "@rezics/i18n";
import { useEffect, useRef, useState } from "react";

export const RegistrationTurnstileAction = "turnstile-spin-v1";

const TurnstileScriptId = "cloudflare-turnstile-script";
const TurnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileRenderOptions = {
	action: typeof RegistrationTurnstileAction;
	appearance: "always";
	callback: (token: string) => void;
	execution: "render";
	"error-callback": () => void;
	"expired-callback": () => void;
	language: string;
	"refresh-expired": "auto";
	"refresh-timeout": "auto";
	"response-field": false;
	retry: "auto";
	sitekey: string;
	size: "flexible";
	theme: "auto";
	"timeout-callback": () => void;
};

type TurnstileApi = {
	remove: (widgetId: string) => void;
	render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
};

let turnstileScriptPromise: Promise<TurnstileApi> | undefined;

function turnstileLanguage(locale: UiLocale): string {
	switch (locale) {
		case "zh-Hant":
			return "zh-tw";
		case "zh-Hans":
			return "zh-cn";
		case "de":
		case "en":
		case "es":
		case "fr":
		case "ja":
		case "ko":
			return locale;
	}
}

function readTurnstileApi(): TurnstileApi | undefined {
	const candidate: unknown = Reflect.get(window, "turnstile");
	if (typeof candidate !== "object" || candidate === null) return undefined;

	const render: unknown = Reflect.get(candidate, "render");
	const remove: unknown = Reflect.get(candidate, "remove");
	if (typeof render !== "function" || typeof remove !== "function") return undefined;

	return {
		render(container, options) {
			const widgetId: unknown = Reflect.apply(render, candidate, [container, options]);
			if (typeof widgetId !== "string")
				throw new TypeError("Cloudflare Turnstile returned an invalid widget identifier");
			return widgetId;
		},
		remove(widgetId) {
			Reflect.apply(remove, candidate, [widgetId]);
		},
	};
}

function loadTurnstileApi(): Promise<TurnstileApi> {
	const loaded = readTurnstileApi();
	if (loaded) return Promise.resolve(loaded);
	if (turnstileScriptPromise) return turnstileScriptPromise;

	turnstileScriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
		const existing = document.getElementById(TurnstileScriptId);
		const script =
			existing instanceof HTMLScriptElement ? existing : document.createElement("script");

		const cleanup = () => {
			script.removeEventListener("load", onLoad);
			script.removeEventListener("error", onError);
		};
		const onLoad = () => {
			cleanup();
			const api = readTurnstileApi();
			if (api) resolve(api);
			else reject(new Error("Cloudflare Turnstile loaded without its JavaScript API"));
		};
		const onError = () => {
			cleanup();
			reject(new Error("Cloudflare Turnstile failed to load"));
		};

		script.addEventListener("load", onLoad, { once: true });
		script.addEventListener("error", onError, { once: true });

		if (!existing) {
			script.async = true;
			script.defer = true;
			script.id = TurnstileScriptId;
			script.src = TurnstileScriptUrl;
			document.head.append(script);
		}
	}).catch((cause: unknown) => {
		turnstileScriptPromise = undefined;
		throw cause;
	});

	return turnstileScriptPromise;
}

export function TurnstileWidget({
	label,
	locale,
	onTokenChange,
	resetKey,
	siteKey,
	unavailableMessage,
}: {
	readonly label: string;
	readonly locale: UiLocale;
	readonly onTokenChange: (token: string | null) => void;
	readonly resetKey: number;
	readonly siteKey: string;
	readonly unavailableMessage: string;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const onTokenChangeRef = useRef(onTokenChange);
	const [unavailable, setUnavailable] = useState(false);

	useEffect(() => {
		onTokenChangeRef.current = onTokenChange;
	}, [onTokenChange]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let active = true;
		let api: TurnstileApi | undefined;
		let widgetId: string | undefined;
		onTokenChangeRef.current(null);
		setUnavailable(false);

		void loadTurnstileApi()
			.then((loadedApi) => {
				if (!active) return;
				api = loadedApi;
				widgetId = loadedApi.render(container, {
					action: RegistrationTurnstileAction,
					appearance: "always",
					callback(token) {
						if (!active) return;
						if (!token) {
							onTokenChangeRef.current(null);
							setUnavailable(true);
							return;
						}
						setUnavailable(false);
						onTokenChangeRef.current(token);
					},
					execution: "render",
					"error-callback": () => {
						if (!active) return;
						onTokenChangeRef.current(null);
						setUnavailable(true);
					},
					"expired-callback": () => {
						if (active) onTokenChangeRef.current(null);
					},
					language: turnstileLanguage(locale),
					"refresh-expired": "auto",
					"refresh-timeout": "auto",
					"response-field": false,
					retry: "auto",
					sitekey: siteKey,
					size: "flexible",
					theme: "auto",
					"timeout-callback": () => {
						if (active) onTokenChangeRef.current(null);
					},
				});
			})
			.catch(() => {
				if (!active) return;
				onTokenChangeRef.current(null);
				setUnavailable(true);
			});

		return () => {
			active = false;
			if (api && widgetId) api.remove(widgetId);
		};
	}, [locale, resetKey, siteKey]);

	return (
		<div className="space-y-2">
			<div aria-label={label} className="min-h-[65px] w-full" ref={containerRef} role="group" />
			{unavailable ? (
				<p className="text-destructive text-sm" role="alert">
					{unavailableMessage}
				</p>
			) : null}
		</div>
	);
}
