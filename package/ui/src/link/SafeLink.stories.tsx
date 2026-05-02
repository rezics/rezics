import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useMemo } from "react";

import { ExternalLinkModal } from "./ExternalLinkModal";
import { SafeLink } from "./SafeLink";

interface SafeLinkPreviewProps {
  href: string;
  label: string;
}

function SafeLinkPreview({ href, label }: SafeLinkPreviewProps) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => (
        <div className="space-y-3">
          <SafeLink href={href} className="text-rose-600 hover:underline">
            {label}
          </SafeLink>
          <Outlet />
          <ExternalLinkModal />
        </div>
      ),
    });
    return createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  }, [href, label]);

  return <RouterProvider router={router as never} />;
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
