import type { Meta, StoryObj } from "@storybook/react-vite";

import type { Action } from "../types";
import { OverflowMenu } from "./OverflowMenu";

const logInvoke = (action: Action) => {
  // eslint-disable-next-line no-console
  console.log("Overflow action invoked:", action);
};

const meta = {
  title: "App/Engagement/OverflowMenu",
  component: OverflowMenu,
} satisfies Meta<typeof OverflowMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MdShelfAndShare: Story = {
  render: () => (
    <OverflowMenu size="md" items={["shelf", "share"]} onInvoke={logInvoke} />
  ),
};

export const SmReplyOnly: Story = {
  render: () => (
    <OverflowMenu size="sm" items={["reply"]} onInvoke={logInvoke} />
  ),
};

export const LgAllOverflowTokens: Story = {
  render: () => (
    <OverflowMenu
      size="lg"
      items={["reply", "share", "shelf"]}
      onInvoke={logInvoke}
    />
  ),
};
