import { Providers } from "@/components/Providers";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "rezics",
  description: "Community-driven, cross-language catalog of works",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
