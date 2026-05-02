import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useMemo } from "react";

import { Link } from "./Link";

interface LinkPreviewProps {
  to: string;
  label: string;
}

function LinkPreview({ to, label }: LinkPreviewProps) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => (
        <div className="space-y-3">
          <Link to={to} className="text-rose-600 hover:underline">
            {label}
          </Link>
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
  title: "Primitive/Link/Link",
  component: LinkPreview,
  args: { to: "/", label: "Browse the library" },
} satisfies Meta<typeof LinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
