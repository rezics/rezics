import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { bookFew } from "@/stories/fixtures/book";
import { ReleaseSelector } from "./ReleaseSelector";

const meta = {
  title: "Domain/Book/ReleaseSelector",
  component: ReleaseSelector,
  decorators: [withRouter],
  args: {
    bookInfo: bookFew,
    selectedLang: "en",
    selectedReleaseUnitId: bookFew.unitId,
    onSelect: () => {},
  },
  parameters: {
    docs: {
      description: {
        component:
          "Selector for sibling releases of the same work. Without backend data the component returns null (only one release in scope); use this story as the contract reference for the prop shape.",
      },
    },
  },
} satisfies Meta<typeof ReleaseSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
