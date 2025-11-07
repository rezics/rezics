import * as React from 'react';
import {Link as WouterLink} from 'wouter';
import MuiLink, {type LinkProps as MuiLinkProps} from '@mui/material/Link';

export interface RouterLinkProps extends MuiLinkProps {
  href: string;
}

export const RouterLink = React.forwardRef<HTMLAnchorElement, RouterLinkProps>(
  ({href, ...props}, ref) => (
    <WouterLink href={href} asChild>
      <MuiLink ref={ref} {...props} />
    </WouterLink>
  ),
);

RouterLink.displayName = 'RouterLink';
