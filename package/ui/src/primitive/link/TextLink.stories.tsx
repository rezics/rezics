import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useMemo } from "react";

import { TextLink } from "./TextLink";

interface TextLinkPreviewProps {
  to: string;
  label: string;
}

function TextLinkPreview({ to, label }: TextLinkPreviewProps) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => (
        <div className="space-y-3">
          <TextLink to={to} underline="hover">
            {label}
          </TextLink>
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
  title: "Primitive/Link/TextLink",
  component: TextLinkPreview,
  args: { to: "/", label: "Open author profile" },
} satisfies Meta<typeof TextLinkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
