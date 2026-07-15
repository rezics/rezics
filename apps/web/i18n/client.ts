"use client";

import { create } from "@nmnmcc/intee/next/client";
import { Languages } from "@rezics/i18n";

export const { TranslationProvider, useSetLocale, useTranslation } = create(Languages);
