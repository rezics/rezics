import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  realmDefault,
  realmOfficial,
  realmPrivate,
} from "@/stories/fixtures/realm";
import { RealmCard } from "./RealmCard";

const meta = {
  title: "Domain/Realm/RealmCard",
  component: RealmCard,
  decorators: [withRouter],
  args: { realm: realmDefault },
} satisfies Meta<typeof RealmCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { realm: realmPrivate },
};

export const Hero: Story = {
  args: { realm: realmOfficial },
};
