import type { Language } from "@rezics/contract/language-core";
import type { ReactiveMessage } from "./react";

type Options = {
  locale?: Language;
  source?: string;
};

type NoInput = (inputs?: Record<string, never>, options?: Options) => string;
type RequiredInput = (inputs: { count: number }, options?: Options) => string;
type OptionalInput = (inputs?: { name?: string }, options?: Options) => string;

declare const noInput: ReactiveMessage<NoInput>;
declare const requiredInput: ReactiveMessage<RequiredInput>;
declare const optionalInput: ReactiveMessage<OptionalInput>;

noInput();
noInput({}, { source: "fixture" });

requiredInput({ count: 1 });
requiredInput({ count: 1 }, { source: "fixture" });

optionalInput();
optionalInput({ name: "Rezics" });

// @ts-expect-error required message inputs must stay required
requiredInput();

// @ts-expect-error required message input shapes must be preserved
requiredInput({ count: "1" });

// @ts-expect-error locale is supplied by the adapter wrapper
noInput({}, { locale: "en" });
