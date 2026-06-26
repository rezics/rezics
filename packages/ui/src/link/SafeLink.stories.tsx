import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import { ExternalLinkModal } from "./ExternalLinkModal";
import { SafeLink } from "./SafeLink";

const StoryAnchor = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ children, ...props }, ref) => (
  <a ref={ref} {...props}>
    {children}
  </a>
));
StoryAnchor.displayName = "StoryAnchor";

interface SafeLinkPreviewProps {
  href: string;
  label: string;
}

function SafeLinkPreview({ href, label }: SafeLinkPreviewProps) {
  return (
    <div className="space-y-3">
      <SafeLink
        href={href}
        className="text-link hover:underline"
        linkRenderer={({ href, children, className, title, ...rest }) => (
          <StoryAnchor href={href} className={className} title={title} {...rest}>
            {children}
          </StoryAnchor>
        )}
      >
        {label}
      </SafeLink>
      <ExternalLinkModal />
    </div>
  );
}

const meta = {
  title: "Composite/Link/SafeLink",
  component: SafeLinkPreview,
  args: { href: "https://example.com", label: "Open external site" },
} satisfies Meta<typeof SafeLinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InternalRoute: Story = {
  args: { href: "/library", label: "Browse the library" },
};

export const RezicsHost: Story = {
  args: {
    href: "https://rezics.com/help",
    label: "Read the help center",
  },
};
