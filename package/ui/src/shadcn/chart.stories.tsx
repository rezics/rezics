import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";

const data = [
  { month: "Jan", reads: 18, highlights: 6 },
  { month: "Feb", reads: 22, highlights: 9 },
  { month: "Mar", reads: 14, highlights: 5 },
  { month: "Apr", reads: 28, highlights: 12 },
  { month: "May", reads: 31, highlights: 14 },
  { month: "Jun", reads: 24, highlights: 11 },
];

const config = {
  reads: { label: "Books read", color: "var(--colors-brand-fill)" },
  highlights: {
    label: "Highlights",
    color: "var(--colors-feedback-success-fill)",
  },
} satisfies ChartConfig;

const meta: Meta<typeof ChartContainer> = {
  title: "Primitives/Chart",
  component: ChartContainer,
};

export default meta;
type Story = StoryObj<typeof ChartContainer>;

export const Default: Story = {
  render: () => (
    <ChartContainer config={config} className="h-64 w-full max-w-2xl">
      <BarChart data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="reads" fill="var(--color-reads)" radius={4} />
        <Bar dataKey="highlights" fill="var(--color-highlights)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};
