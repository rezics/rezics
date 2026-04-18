import { classifyUrl } from "@rezics/contract";
import { Link as RouterLink } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { openExternal } from "./store";

export interface SafeLinkProps {
  href: string;
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
  title?: string;
}

export function SafeLink({
  href,
  children,
  className,
  title,
  ...rest
}: SafeLinkProps) {
  const { kind, href: resolvedHref } = classifyUrl(href);

  if (kind === "blocked") {
    return (
      <span className={className} title={title} {...rest}>
        {children}
      </span>
    );
  }

  if (kind === "app-route") {
    return (
      <RouterLink to={resolvedHref} className={className} title={title}>
        {children}
      </RouterLink>
    );
  }

  if (kind === "rezics") {
    return (
      <a
        href={resolvedHref}
        rel="noopener noreferrer"
        className={className}
        title={title}
        {...rest}
      >
        {children}
      </a>
    );
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    openExternal(resolvedHref);
  };

  return (
    <a
      href={resolvedHref}
      rel="noopener noreferrer"
      target="_blank"
      onClick={handleClick}
      className={className}
      title={title}
      {...rest}
    >
      {children}
    </a>
  );
}

export function InternalLink({
  href,
  children,
  className,
  title,
}: SafeLinkProps) {
  return (
    <RouterLink to={href} className={className} title={title}>
      {children}
    </RouterLink>
  );
}

export function ExternalLink({
  href,
  children,
  className,
  title,
  ...rest
}: SafeLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    openExternal(href);
  };

  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      onClick={handleClick}
      className={className}
      title={title}
      {...rest}
    >
      {children}
    </a>
  );
}
