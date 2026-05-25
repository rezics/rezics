import {
  DEFAULT_LANGUAGE,
  type Language,
  normalizeLanguage,
} from "@rezics/contract";
import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "lang";
const listeners = new Set<() => void>();
const registeredRuntimes = new Set<RuntimeRegistration>();
const registrationsByRuntime = new Map<
  RegisteredRuntime,
  { registration: RuntimeRegistration; refs: number }
>();

let activeLocale = readStoredLocale();

export type LocaleListener = () => void;

export type RuntimeSetLocaleOptions = {
  reload?: boolean;
};

export type RuntimeSetLocale = (
  locale: Language,
  options?: RuntimeSetLocaleOptions,
) => void | Promise<void>;

export type RegisteredRuntime = {
  getLocale: () => Language;
  setLocale: RuntimeSetLocale;
  overwriteGetLocale: (fn: () => Language) => void;
  overwriteSetLocale: (fn: RuntimeSetLocale) => void;
};

type RuntimeRegistration = {
  runtime: RegisteredRuntime;
  originalGetLocale: () => Language;
  originalSetLocale: RuntimeSetLocale;
};

export type InitI18nOptions = {
  locale?: Language | string | null;
};

export type MessageOptions = {
  locale?: Language;
};

export type MessageCallOptions<TOptions> = TOptions extends object
  ? Omit<TOptions, "locale">
  : never;

export type NoInputMessage<
  TResult = string,
  TOptions extends MessageOptions = MessageOptions,
> = (inputs?: Record<string, never>, options?: TOptions) => TResult;

export type RequiredInputMessage<
  TInputs,
  TResult = string,
  TOptions extends MessageOptions = MessageOptions,
> = (inputs: TInputs, options?: TOptions) => TResult;

export type OptionalInputMessage<
  TInputs,
  TResult = string,
  TOptions extends MessageOptions = MessageOptions,
> = (inputs?: TInputs, options?: TOptions) => TResult;

export type MessageFunction = (...args: any[]) => unknown;

export type MessageBag = Record<string, MessageFunction>;

export type ReactiveMessage<TMessage extends MessageFunction> =
  TMessage extends (
    inputs: infer TInputs,
    options?: infer TOptions,
  ) => infer TResult
    ? {} extends NonNullable<TInputs>
      ? (
          inputs?: TInputs,
          options?: MessageCallOptions<NonNullable<TOptions>>,
        ) => TResult
      : (
          inputs: TInputs,
          options?: MessageCallOptions<NonNullable<TOptions>>,
        ) => TResult
    : never;

export type ReactiveMessageBag<TBag extends MessageBag> = {
  [TKey in keyof TBag]: ReactiveMessage<TBag[TKey]>;
};

function readStoredLocale(): Language {
  if (typeof localStorage === "undefined") return DEFAULT_LANGUAGE;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_LANGUAGE;

  return normalizeLanguage(stored) ?? DEFAULT_LANGUAGE;
}

function persistLocale(locale: Language): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
}

function coerceLocale(locale: Language | string): Language {
  const normalized = normalizeLanguage(locale);
  if (!normalized) {
    throw new RangeError(`Unsupported Rezics locale: ${locale}`);
  }
  return normalized;
}

function emitLocaleChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function fanoutLocale(locale: Language): void {
  for (const registration of registeredRuntimes) {
    registration.originalSetLocale(locale, { reload: false });
  }
}

function applyLocale(locale: Language | string): void {
  const nextLocale = coerceLocale(locale);
  if (nextLocale === activeLocale) {
    persistLocale(nextLocale);
    fanoutLocale(nextLocale);
    return;
  }

  activeLocale = nextLocale;
  persistLocale(nextLocale);
  fanoutLocale(nextLocale);
  emitLocaleChange();
}

export function initI18n(options: InitI18nOptions = {}): void {
  applyLocale(options.locale ?? readStoredLocale());
}

export function getLocale(): Language {
  return activeLocale;
}

export function setLocale(locale: Language | string): void {
  applyLocale(locale);
}

export function subscribeLocale(listener: LocaleListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLocale(): Language {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export function useSetLocale(): (locale: Language | string) => void {
  return setLocale;
}

export function registerParaglideRuntime(
  runtime: RegisteredRuntime,
): () => void {
  const existingRegistration = registrationsByRuntime.get(runtime);
  if (existingRegistration) {
    existingRegistration.refs += 1;
    return () => {
      existingRegistration.refs -= 1;
      if (existingRegistration.refs > 0) return;
      registrationsByRuntime.delete(runtime);
      registeredRuntimes.delete(existingRegistration.registration);
      runtime.overwriteGetLocale(
        existingRegistration.registration.originalGetLocale,
      );
      runtime.overwriteSetLocale(
        existingRegistration.registration.originalSetLocale,
      );
    };
  }

  const registration: RuntimeRegistration = {
    runtime,
    originalGetLocale: runtime.getLocale,
    originalSetLocale: runtime.setLocale,
  };

  registeredRuntimes.add(registration);
  registrationsByRuntime.set(runtime, { registration, refs: 1 });
  runtime.overwriteGetLocale(getLocale);
  runtime.overwriteSetLocale((locale) => {
    applyLocale(locale);
  });
  registration.originalSetLocale(activeLocale, { reload: false });

  return () => {
    const trackedRegistration = registrationsByRuntime.get(runtime);
    if (trackedRegistration) {
      trackedRegistration.refs -= 1;
      if (trackedRegistration.refs > 0) return;
      registrationsByRuntime.delete(runtime);
    }
    registeredRuntimes.delete(registration);
    runtime.overwriteGetLocale(registration.originalGetLocale);
    runtime.overwriteSetLocale(registration.originalSetLocale);
  };
}

export function useMessage<TBag extends MessageBag>(
  bag: TBag,
): ReactiveMessageBag<TBag> {
  const locale = useLocale();

  return useMemo(() => {
    const wrappedMessages = {} as ReactiveMessageBag<TBag>;

    for (const key of Object.keys(bag) as Array<keyof TBag>) {
      const message = bag[key] as (
        inputs?: unknown,
        options?: MessageOptions,
      ) => unknown;
      wrappedMessages[key] = ((inputs?: unknown, options?: MessageOptions) =>
        message(inputs, {
          ...options,
          locale,
        })) as ReactiveMessage<TBag[typeof key]>;
    }

    return wrappedMessages;
  }, [bag, locale]);
}
