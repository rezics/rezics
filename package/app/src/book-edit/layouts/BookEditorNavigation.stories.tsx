import type { Meta, StoryObj } from "@storybook/react-vite";
import { NavigationList } from "@/core/components/navigation/NavigationList";
import { withRouter } from "@/stories/decorators/withRouter";
import { historyBookId } from "@/stories/fixtures/history";
import { createBookEditConsoleConfig } from "./bookEditConsoleConfig";

const meta = {
  title: "Domain/Book/Edit/Sidebar Navigation",
  decorators: [withRouter],
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function bookConsoleNavigation() {
  const config = createBookEditConsoleConfig(historyBookId);
  return [
    config.returnItem,
    ...config.primaryItems,
    ...(config.operationalItems ?? []),
  ].map((item) => ({
    kind: "item" as const,
    title: item.label,
    segment: item.href,
    icon: item.icon,
    activeMatch: item.activeMatch,
    isActive: item.isActive,
  }));
}

export const SidebarItems: Story = {
  render: () => (
    <nav className="w-72 rounded-md bg-surface-base p-3">
      <NavigationList
        NAVIGATION={bookConsoleNavigation()}
        isMobile={false}
        pathname={`/book/${historyBookId}/edit/authority`}
        openItems={{}}
        handleItemClick={() => undefined}
      />
    </nav>
  ),
};
