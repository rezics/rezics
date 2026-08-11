"use client";

import { isContentLanguage, toContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { usePathname, useSearchParams } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
} from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useAuthSession } from "@/features/auth/session-provider";
import { useTranslation } from "@/i18n/client";
import {
	parseContentLanguageOrder,
	type ContentLanguageOrder,
} from "../model/content-language-order";
import {
	readStoredLocalizedDraft,
	removeStoredLocalizedDraft,
	scheduleStoredLocalizedDraft,
} from "../model/localized-draft-storage";

type LocalizedDraftEnvelope = {
	readonly schemaVersion: number;
	readonly baseVersion: string | null;
	readonly value: unknown;
};

const localizedDraftMemory = new Map<string, LocalizedDraftEnvelope>();
const localizedDirtyDraftKeys = new Set<string>();

interface ContentLanguageEditorContextValue {
	readonly unitId: string;
	readonly languages: ContentLanguageOrder;
	readonly selectedLanguage: ContentLanguage;
	readonly selectedLanguageIsPending: boolean;
	readonly dirty: boolean;
	readonly requestLanguage: (language: ContentLanguage) => boolean;
	readonly replaceLanguage: (language: ContentLanguage) => void;
	readonly setDirty: (dirty: boolean) => void;
	readonly languagesChanged: () => Promise<void>;
}

const ContentLanguageEditorContext = createContext<ContentLanguageEditorContextValue | undefined>(
	undefined,
);

export function ContentLanguageEditorProvider({
	unitId,
	localizations,
	onLanguagesChanged,
	children,
}: {
	readonly unitId: string;
	readonly localizations: readonly { readonly language: ContentLanguage }[];
	readonly onLanguagesChanged: () => void | Promise<void>;
	readonly children: ReactNode;
}) {
	const { locale } = useTranslation(["units"]);
	const router = useApplicationRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [dirty, setDirty] = useState(false);
	useEffect(() => {
		if (!dirty) return;
		const warnBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warnBeforeUnload);
		return () => window.removeEventListener("beforeunload", warnBeforeUnload);
	}, [dirty]);
	const languages = useMemo(() => {
		const parsed = parseContentLanguageOrder(localizations.map(({ language }) => language));
		if (!parsed) throw new Error("A Unit editor requires at least one unique content language");
		return parsed;
	}, [localizations]);
	const requestedLanguage = searchParams.get("language");
	const [initialLanguage] = useState<ContentLanguage>(() => {
		if (requestedLanguage && isContentLanguage(requestedLanguage)) return requestedLanguage;
		const interfaceLanguage = toContentLanguage(locale.target);
		return languages.includes(interfaceLanguage) ? interfaceLanguage : languages[0];
	});
	const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
	useEffect(() => {
		setSelectedLanguage(
			requestedLanguage && isContentLanguage(requestedLanguage)
				? requestedLanguage
				: initialLanguage,
		);
	}, [initialLanguage, requestedLanguage]);

	const writeLanguage = useCallback(
		(language: ContentLanguage) => {
			const next = new URLSearchParams(searchParams.toString());
			next.set("language", language);
			router.replace(`${pathname}?${next.toString()}`, { scroll: false });
		},
		[pathname, router, searchParams],
	);
	const requestLanguage = useCallback(
		(language: ContentLanguage) => {
			if (language === selectedLanguage) return true;
			setSelectedLanguage(language);
			writeLanguage(language);
			return true;
		},
		[selectedLanguage, writeLanguage],
	);
	const replaceLanguage = useCallback(
		(language: ContentLanguage) => {
			setSelectedLanguage(language);
			writeLanguage(language);
		},
		[writeLanguage],
	);
	const languagesChanged = useCallback(async () => {
		await onLanguagesChanged();
	}, [onLanguagesChanged]);
	const value = useMemo<ContentLanguageEditorContextValue>(
		() => ({
			unitId,
			languages,
			selectedLanguage,
			selectedLanguageIsPending: !languages.includes(selectedLanguage),
			dirty,
			requestLanguage,
			replaceLanguage,
			setDirty,
			languagesChanged,
		}),
		[
			dirty,
			languages,
			languagesChanged,
			replaceLanguage,
			requestLanguage,
			selectedLanguage,
			unitId,
		],
	);
	return (
		<ContentLanguageEditorContext.Provider value={value}>
			{children}
		</ContentLanguageEditorContext.Provider>
	);
}

export function useContentLanguageEditor(): ContentLanguageEditorContextValue {
	const value = useContext(ContentLanguageEditorContext);
	if (!value) throw new Error("Content language controls require a ContentLanguageEditorProvider");
	return value;
}

export interface LocalizedDraftCodec<Value extends object> {
	readonly version: number;
	readonly decode: (value: unknown) => Value | undefined;
}

export interface LocalizedDraftState<Value extends object> {
	readonly value: Value;
	readonly setValue: Dispatch<SetStateAction<Value>>;
	readonly dirty: boolean;
	readonly hydrated: boolean;
	readonly serverChanged: boolean;
	readonly commit: () => void;
	readonly discard: () => void;
}

export function useLocalizedDraft<Value extends object>({
	scope,
	baseVersion,
	createInitialValue,
	codec,
	partition = "selected-language",
}: {
	readonly scope: string;
	readonly baseVersion: string | null;
	readonly createInitialValue: () => Value;
	readonly codec: LocalizedDraftCodec<Value>;
	readonly partition?: "selected-language" | "shared";
}): LocalizedDraftState<Value> {
	const session = useAuthSession();
	const { unitId, selectedLanguage, setDirty } = useContentLanguageEditor();
	const partitionKey = partition === "shared" ? "shared" : `language:${selectedLanguage}`;
	const accountId = session.data?.user.id ?? null;
	const ownerKey = JSON.stringify(["localized-draft", 1, accountId, unitId]);
	const memoryKey = `${ownerKey}\u0000${scope}\u0000${partitionKey}`;
	const storageKey = accountId
		? JSON.stringify(["localized-draft", 1, accountId, unitId, scope, partitionKey])
		: null;
	const [initialServerValue] = useState(createInitialValue);
	const serverValueRef = useRef(initialServerValue);
	const [memoryDraft] = useState(() => localizedDraftMemory.get(memoryKey));
	const [decodedMemoryDraft] = useState(() =>
		memoryDraft?.schemaVersion === codec.version ? codec.decode(memoryDraft.value) : undefined,
	);
	const [value, setValueState] = useState(decodedMemoryDraft ?? initialServerValue);
	const valueRef = useRef(value);
	const [dirty, setLocalDirty] = useState(Boolean(decodedMemoryDraft));
	const dirtyRef = useRef(Boolean(decodedMemoryDraft));
	const draftBaseVersionRef = useRef(
		decodedMemoryDraft && memoryDraft ? memoryDraft.baseVersion : baseVersion,
	);
	const [hydrated, setHydrated] = useState(Boolean(decodedMemoryDraft) || !storageKey);
	const [serverChanged, setServerChanged] = useState(
		Boolean(decodedMemoryDraft && memoryDraft?.baseVersion !== baseVersion),
	);
	const identityKey = useRef(memoryKey);
	if (identityKey.current !== memoryKey)
		throw new Error("An editor draft component must be keyed by its draft partition");
	const [renderedBaseVersion, setRenderedBaseVersion] = useState(baseVersion);
	if (renderedBaseVersion !== baseVersion) {
		const nextServerValue = createInitialValue();
		serverValueRef.current = nextServerValue;
		setRenderedBaseVersion(baseVersion);
		if (dirtyRef.current) setServerChanged(draftBaseVersionRef.current !== baseVersion);
		else {
			valueRef.current = nextServerValue;
			setValueState(nextServerValue);
			setServerChanged(false);
			draftBaseVersionRef.current = baseVersion;
		}
	}

	const syncDirty = useCallback(
		(nextDirty: boolean) => {
			if (nextDirty) localizedDirtyDraftKeys.add(memoryKey);
			else localizedDirtyDraftKeys.delete(memoryKey);
			setDirty(
				[...localizedDirtyDraftKeys].some((candidate) => candidate.startsWith(`${ownerKey}\u0000`)),
			);
		},
		[memoryKey, ownerKey, setDirty],
	);

	useEffect(() => {
		if (decodedMemoryDraft) syncDirty(true);
	}, [decodedMemoryDraft, syncDirty]);

	useEffect(() => {
		if (!storageKey || decodedMemoryDraft) return;
		let cancelled = false;
		void readStoredLocalizedDraft(storageKey).then((stored) => {
			if (cancelled) return;
			const decoded =
				stored?.schemaVersion === codec.version ? codec.decode(stored.value) : undefined;
			if (decoded && stored) {
				localizedDraftMemory.set(memoryKey, {
					schemaVersion: stored.schemaVersion,
					baseVersion: stored.baseVersion,
					value: decoded,
				});
				valueRef.current = decoded;
				setValueState(decoded);
				dirtyRef.current = true;
				draftBaseVersionRef.current = stored.baseVersion;
				setLocalDirty(true);
				setServerChanged(stored.baseVersion !== baseVersion);
				syncDirty(true);
			}
			setHydrated(true);
		});
		return () => {
			cancelled = true;
		};
	}, [baseVersion, codec, decodedMemoryDraft, memoryKey, storageKey, syncDirty]);

	const setValue = useCallback<Dispatch<SetStateAction<Value>>>(
		(action) => {
			const next = typeof action === "function" ? action(valueRef.current) : action;
			if (!dirtyRef.current) draftBaseVersionRef.current = baseVersion;
			valueRef.current = next;
			setValueState(next);
			dirtyRef.current = true;
			setLocalDirty(true);
			const envelope = {
				schemaVersion: codec.version,
				baseVersion: draftBaseVersionRef.current,
				value: next,
			};
			localizedDraftMemory.set(memoryKey, envelope);
			syncDirty(true);
			if (storageKey) scheduleStoredLocalizedDraft({ key: storageKey, ...envelope });
		},
		[baseVersion, codec.version, memoryKey, storageKey, syncDirty],
	);
	const commit = useCallback(() => {
		localizedDraftMemory.delete(memoryKey);
		syncDirty(false);
		dirtyRef.current = false;
		draftBaseVersionRef.current = baseVersion;
		setLocalDirty(false);
		setServerChanged(false);
		if (storageKey) void removeStoredLocalizedDraft(storageKey);
	}, [baseVersion, memoryKey, storageKey, syncDirty]);
	const discard = useCallback(() => {
		valueRef.current = serverValueRef.current;
		setValueState(serverValueRef.current);
		commit();
	}, [commit]);

	return { value, setValue, dirty, hydrated, serverChanged, commit, discard };
}
