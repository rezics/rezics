import { create } from "native-i18n/next/server";
import { resources } from "@rezics/i18n/resources";

export const { getLocaleTags, getTranslation, matchLocale, preload } = create(resources);
