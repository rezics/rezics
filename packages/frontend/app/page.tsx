import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, getPagePath } from "@/lib/about/locales";

export default function HomePage() {
  redirect(getPagePath(DEFAULT_LOCALE, "home"));
}
