"use client";

import { create } from "native-i18n/next/client";
import { resources } from "@rezics/i18n/resources";

export const { preload, TranslationProvider, useLocale, useSetLocale, useTranslation } =
	create(resources);
