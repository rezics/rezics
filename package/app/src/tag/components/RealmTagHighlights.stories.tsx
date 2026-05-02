import type { Meta, StoryObj } from "@storybook/react-vite";

import { RealmTagHighlights } from "./RealmTagHighlights";

const meta = {
  title: "Domain/Tag/RealmTagHighlights",
  component: RealmTagHighlights,
  args: {
    realmHighlights: [
      {
        realmUnitId: "realm-fiction",
        realmName: "Fiction Club",
        tags: ["fiction", "literary", "novella"],
      },
      {
        realmUnitId: "realm-poetry",
        realmName: "Poetry Salon",
        tags: ["poetry", "translation"],
      },
    ],
  },
} satisfies Meta<typeof RealmTagHighlights>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { realmHighlights: [] },
};
