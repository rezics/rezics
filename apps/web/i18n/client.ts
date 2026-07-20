"use client";

import { create } from "native-i18n/next/client";
import type { resources } from "@rezics/i18n/resources";

export const { TranslationProvider, useLocale, useSetLocale, useTranslation } =
	create<typeof resources>();
