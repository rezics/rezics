import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { realmList } from "@/stories/fixtures/realm";
import { RealmList } from "./RealmList";

const meta = {
  title: "Domain/Realm/RealmList",
  component: RealmList,
  decorators: [withRouter],
  args: { realms: realmList },
} satisfies Meta<typeof RealmList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { realms: [] },
};
