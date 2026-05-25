import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavigationList } from "@/core/components/navigation/NavigationList";
import { historyBookId } from "@/stories/fixtures/history";
import { withRouter } from "@/stories/decorators/withRouter";
import { NAVIGATION } from "./BookEditorNavigation";

const meta = {
  title: "Domain/Book/Edit/Sidebar Navigation",
  decorators: [withRouter],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SidebarItems: Story = {
  render: () => (
    <nav className="w-72 rounded-md bg-surface-base p-3">
      <NavigationList
        NAVIGATION={NAVIGATION(historyBookId)}
        isMobile={false}
        pathname={`/book/${historyBookId}/edit/authority`}
        openItems={{}}
        handleItemClick={() => undefined}
      />
    </nav>
  ),
};
