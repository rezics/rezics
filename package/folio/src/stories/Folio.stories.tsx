import type { Meta, StoryObj } from "@storybook/react-vite";
import { Folio } from "../Folio";
import { FALLBACK_TEXT, buildTree } from "../_stubs";

const meta = {
  title: "Folio/Reader",
  parameters: {
    docs: {
      description: {
        component:
          "The `Folio` reader rendering placeholder text. Real content arrives via the txt / epub plugin family at runtime.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const tree = buildTree([
  {
    id: "ch-1",
    title: "Chapter 1",
    content: FALLBACK_TEXT.repeat(8),
  },
  {
    id: "ch-2",
    title: "Chapter 2",
    content: FALLBACK_TEXT.repeat(12),
  },
]);

export const Placeholder: Story = {
  render: () => (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <Folio plugins={[]} tree={tree} />
    </div>
  ),
};
