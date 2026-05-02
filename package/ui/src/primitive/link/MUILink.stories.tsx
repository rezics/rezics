import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useMemo } from "react";

import { MUILink } from "./MUILink";

interface MUILinkPreviewProps {
  to: string;
  label: string;
}

function MUILinkPreview({ to, label }: MUILinkPreviewProps) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => (
        <div className="space-y-3">
          <MUILink to={to} underline="hover">
            {label}
          </MUILink>
          <Outlet />
        </div>
      ),
    });
    return createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  }, [to, label]);

  return <RouterProvider router={router as never} />;
}

const meta = {
  title: "Primitive/Link/MUILink",
  component: MUILinkPreview,
  args: { to: "/", label: "Open author profile" },
} satisfies Meta<typeof MUILinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
