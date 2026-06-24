import "@rezics/ui/config/base.css";
import "github-markdown-css/github-markdown-light.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/admin/app/index.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Rezics",
  description:
    "Rezics is a community for works, knowledge, and creativity to be inherited, created anew, and spread onward.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
