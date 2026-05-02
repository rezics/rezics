import type { Meta, StoryObj } from "@storybook/react-vite";

import { DomainCarousel } from "./DomainCarousel";

interface DemoItem {
  id: string;
  title: string;
}

const fewItems: DemoItem[] = [
  { id: "1", title: "Item One" },
  { id: "2", title: "Item Two" },
  { id: "3", title: "Item Three" },
];

const manyItems: DemoItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  title: `Item ${i + 1}`,
}));

function DemoCard({ title }: DemoItem) {
  return (
    <div className="rounded-xl bg-[var(--rezics-color-surface-card)] p-6 text-[var(--rezics-color-text-primary)] shadow-sm">
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

const meta = {
  title: "Composite/Carousel/DomainCarousel",
  component: DomainCarousel<DemoItem>,
  args: {
    items: fewItems,
    renderItem: (item: DemoItem) => <DemoCard {...item} />,
    itemKey: (item: DemoItem) => item.id,
    itemClassName: "pl-4 basis-[60%] md:basis-[40%] lg:basis-[25%]",
    ariaLabel: "Demo items",
  },
} satisfies Meta<typeof DomainCarousel<DemoItem>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    items: [],
    emptyFallback: (
      <div className="rounded-md border border-dashed p-6 text-sm text-[var(--rezics-color-text-secondary)]">
        Nothing to show
      </div>
    ),
  },
};

export const Loading: Story = {
  args: {
    items: Array.from({ length: 4 }, (_, i) => ({
      id: String(i),
      title: "",
    })),
    renderItem: () => (
      <div className="h-24 w-full animate-pulse rounded-xl bg-[var(--rezics-color-surface-muted)]" />
    ),
  },
};

export const LongContent: Story = {
  args: { items: manyItems },
};

export const Compact: Story = {
  args: {
    items: fewItems.slice(0, 2),
    itemClassName: "pl-4 basis-[80%]",
  },
};
