"use client";

import {
  RezicsI18nProvider,
  useLocale,
} from "@rezics/i18n/react";
import { getTextDirection } from "@rezics/i18n/runtime";
import { RouterProvider } from "@tanstack/react-router";
import { Suspense, useEffect, useRef } from "react";
import { router } from "@/admin/router";
import { AdminAppProviders } from "./AdminAppProviders";

export default function App() {
  return (
    <RezicsI18nProvider>
      <Suspense fallback={null}>
        <AdminAppProviders>
          <LocalizedRouterProvider />
        </AdminAppProviders>
      </Suspense>
    </RezicsI18nProvider>
  );
}

function LocalizedRouterProvider() {
  const locale = useLocale();
  const previousLocaleRef = useRef(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getTextDirection(locale);

    if (previousLocaleRef.current !== locale) {
      previousLocaleRef.current = locale;
      void router.invalidate();
    }
  }, [locale]);

  return <RouterProvider router={router} />;
}
