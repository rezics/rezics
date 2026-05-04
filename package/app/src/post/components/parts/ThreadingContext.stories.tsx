import type { Meta, StoryObj } from "@storybook/react-vite";

import { ThreadingHoverProvider, useThreadingHover } from "./ThreadingContext";

const Demo = () => {
  const { hovered, setHovered } = useThreadingHover();
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: "1px solid",
        borderColor: hovered ? "var(--rezics-sys-color-primary)" : "currentColor",
        color: hovered ? "var(--rezics-sys-color-primary)" : "inherit",
      }}
    >
      hovered: {String(hovered)}
    </button>
  );
};

const Wrapper = () => (
  <ThreadingHoverProvider>
    <Demo />
  </ThreadingHoverProvider>
);

const meta = {
  title: "Domain/Post/ThreadingContext",
  component: Wrapper,
  parameters: {
    docs: {
      description: {
        component:
          "ThreadingHoverProvider broadcasts `hovered` state to descendants. Hover the button to see the context update.",
      },
    },
  },
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
