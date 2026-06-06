import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SearchCategoryNav } from "./SearchCategoryNav";

const meta = {
  title: "Domain/Search/SearchCategoryNav",
  component: SearchCategoryNav,
} satisfies Meta<typeof SearchCategoryNav>;

export default meta;
type Story = StoryObj<typeof meta>;

const Stateful = (args: Parameters<typeof SearchCategoryNav>[0]) => {
  const [value, setValue] = useState(args.value);
  return <SearchCategoryNav {...args} value={value} onChange={setValue} />;
};

export const GlobalScope: Story = {
  render: (args) => <Stateful {...args} />,
  args: {
    scope: { kind: "global" },
    value: "all",
    counts: { books: 42, reviews: 18, realms: 3 },
    onChange: () => {},
  },
};

export const RealmScope: Story = {
  render: (args) => <Stateful {...args} />,
  args: {
    scope: { kind: "realm", realmId: "r-1" },
    value: "books",
    counts: { books: 12, reviews: 5 },
    onChange: () => {},
  },
};

export const BookScope: Story = {
  render: (args) => <Stateful {...args} />,
  args: {
    scope: { kind: "book", unitId: "b-9" },
    value: "reviews",
    counts: { reviews: 8, excerpts: 3 },
    onChange: () => {},
  },
};

export const UserScope: Story = {
  render: (args) => <Stateful {...args} />,
  args: {
    scope: { kind: "user", userId: "u-3" },
    value: "all",
    counts: { books: 1, reviews: 4 },
    onChange: () => {},
  },
};
