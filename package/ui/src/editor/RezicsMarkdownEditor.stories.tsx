import type { Meta, StoryObj } from "@storybook/react-vite";
import { CloudUpload } from "lucide-react";
import type { ImageProvider } from "./image/types";
import type { UserSearchAdapter } from "./plugins/EditorMention";
import { RezicsMarkdownEditor } from "./RezicsMarkdownEditor";

const mockUserSearch: UserSearchAdapter = async (query) =>
  [
    {
      userId: "demo-librarian",
      name: "Demo Librarian",
      avatar: null,
    },
    {
      userId: "archive-reader",
      name: "Archive Reader",
      avatar: null,
    },
  ].filter((user) => user.name?.toLowerCase().includes(query.toLowerCase()));

const mockImageProvider: ImageProvider = {
  name: "mock-upload",
  label: "Mock upload",
  icon: <CloudUpload className="size-4" />,
  render: ({ onInsert }) => (
    <button
      type="button"
      className="rounded-md bg-brand-fill px-3 py-2 text-sm text-text-on-brand"
      onClick={() => onInsert("https://images.rezics.test/demo-cover.jpg")}
    >
      Insert mock image
    </button>
  ),
};

const meta = {
  title: "Editor/RezicsMarkdownEditor",
  component: RezicsMarkdownEditor,
  args: {
    value: "Type @demo to open mention search.",
    userSearch: mockUserSearch,
    imageProviders: [mockImageProvider],
  },
} satisfies Meta<typeof RezicsMarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAdapters: Story = {};
