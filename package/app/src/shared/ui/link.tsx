import { SafeLink, type SafeLinkProps } from "@rezics/ui";
import { createLink, Link as RouterLink } from "@tanstack/react-router";
import { cn } from "@/shared/utils/css-util";
import * as React from "react";

export {
  type IdOnlyType,
  type SlugBearingTopType,
  type UnitHrefInput,
  unitHref,
  useUnitHref,
} from "@rezics/ui/primitive/link";

export const Link = RouterLink;

type Underline = "always" | "hover" | "none";

type RezicsAnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  underline?: Underline;
  color?: string;
  variant?: string;
};

const VARIANT_CLASS: Record<string, string> = {
  body1: "text-base",
  body2: "text-sm",
  caption: "text-xs",
  subtitle1: "text-base font-medium",
  subtitle2: "text-sm font-medium",
};

const RezicsAnchor = React.forwardRef<HTMLAnchorElement, RezicsAnchorProps>(
  (
    {
      underline = "always",
      color: _color,
      variant,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const variantClass = variant ? (VARIANT_CLASS[variant] ?? "") : "";
    const underlineClass =
      underline === "always"
        ? "underline underline-offset-2"
        : underline === "hover"
          ? "no-underline hover:underline underline-offset-2"
          : "no-underline";
    return (
      <a
        ref={ref}
        className={cn(
          "text-link transition-colors",
          underlineClass,
          variantClass,
          className,
        )}
        {...rest}
      >
        {children}
      </a>
    );
  },
);
RezicsAnchor.displayName = "RezicsAnchor";

export const TextLink = createLink(RezicsAnchor);

export function AppSafeLink(props: SafeLinkProps) {
  return (
    <SafeLink
      {...props}
      linkRenderer={({ href, children, className, title, ...rest }) => (
        <RouterLink to={href} className={className} title={title} {...rest}>
          {children}
        </RouterLink>
      )}
    />
  );
}
