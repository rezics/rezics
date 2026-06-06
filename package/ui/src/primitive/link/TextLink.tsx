import clsx from "clsx";
import * as React from "react";

type Underline = "always" | "hover" | "none";

type RezicsAnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
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
      to,
      href,
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
        href={href ?? to}
        className={clsx(
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

export const TextLink = RezicsAnchor;
