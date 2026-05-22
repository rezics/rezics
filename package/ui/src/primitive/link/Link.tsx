import * as React from "react";

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to?: string;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, href, ...props }, ref) => {
    return <a ref={ref} href={href ?? to} {...props} />;
  },
);

Link.displayName = "Link";
