import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, getPagePath } from "@/lib/about/locales";

export default function MediaRedirectPage() {
  redirect(getPagePath(DEFAULT_LOCALE, "media"));
}
