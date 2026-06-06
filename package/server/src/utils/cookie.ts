import type { Cookie } from "elysia";
import { getProdState } from "./getProdState";

const { isProd, isDev } = getProdState();

interface CookieOptions {
  value?: any;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

export function setCookie(cookie: Cookie<any>, options: CookieOptions) {
  cookie.value = options.value;
  cookie.httpOnly = options.httpOnly;
  cookie.secure = options.secure;
  cookie.sameSite = options.sameSite;
  cookie.path = options.path;
  cookie.maxAge = options.maxAge;
}
