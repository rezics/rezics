"use client";

import { SafeLink, type SafeLinkProps } from "@rezics/ui";
import NextLink from "next/link";
import * as React from "react";

export const ADMIN_BASEPATH = "/admin";

type Params = Record<string, string | number | undefined>;
type BuildSearchInput = Record<string, unknown> | undefined;

export function resolveAdminHref(to: string, params?: Params): string {
  let path = to;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        path = path.replaceAll(`$${key}`, String(value));
      }
    }
  }
  if (!path.startsWith(ADMIN_BASEPATH)) {
    path = `${ADMIN_BASEPATH}${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return path;
}

function appendSearch(href: string, search: BuildSearchInput): string {
  if (!search) return href;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `${href}?${serialized}` : href;
}

function appendHash(href: string, hash: string | undefined): string {
  if (!hash) return href;
  return hash.startsWith("#") ? `${href}${hash}` : `${href}#${hash}`;
}

type AdminLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  to: string;
  params?: Params;
  search?: BuildSearchInput;
  hash?: string;
  replace?: boolean;
};

export function Link({
  to,
  params,
  search,
  hash,
  replace,
  ...rest
}: AdminLinkProps): React.ReactElement {
  const base = resolveAdminHref(to, params);
  const withSearch = appendSearch(base, search);
  const href = appendHash(withSearch, hash);
  return <NextLink href={href} replace={Boolean(replace)} {...rest} />;
}

export function AdminSafeLink(props: SafeLinkProps) {
  return (
    <SafeLink
      {...props}
      linkRenderer={({ href, children, className, title, ...rest }) => (
        <NextLink
          href={href}
          className={className}
          title={title}
          {...(rest as Omit<
            React.AnchorHTMLAttributes<HTMLAnchorElement>,
            "href" | "className" | "title"
          >)}
        >
          {children}
        </NextLink>
      )}
    />
  );
}