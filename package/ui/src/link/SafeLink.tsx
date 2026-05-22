import { classifyUrl } from "@rezics/contract";
import type { MouseEvent, ReactNode } from "react";
import { openExternal } from "./store";

export type LinkRendererProps = {
  href: string;
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
  title?: string;
};

export type LinkRenderer = (props: LinkRendererProps) => ReactNode;

export interface SafeLinkProps {
  href: string;
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
  title?: string;
  linkRenderer?: LinkRenderer;
}

export function SafeLink({
  href,
  children,
  className,
  title,
  linkRenderer,
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
    if (linkRenderer) {
      return linkRenderer({
        href: resolvedHref,
        children,
        className,
        title,
        ...rest,
      });
    }

    return (
      <a href={resolvedHref} className={className} title={title} {...rest}>
        {children}
      </a>
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
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
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

export function ExternalLink({
  href,
  children,
  className,
  title,
  ...rest
}: SafeLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
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
