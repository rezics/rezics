import type { Meta, StoryObj } from "@storybook/react-vite";

import { LazyLoadImage } from "./LazyLoadImage";

const meta = {
  title: "Primitive/Image/LazyLoadImage",
  component: LazyLoadImage,
  args: {
    alt: "Sample cover",
    src: "https://picsum.photos/seed/rezics-cover/320/420",
    width: 320,
    height: 420,
  },
} satisfies Meta<typeof LazyLoadImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: {
    src: "https://picsum.photos/seed/rezics-large/960/540",
    width: 960,
    height: 540,
    alt: "Large hero",
  },
};

export const Loading: Story = {
  args: {
    src: "https://picsum.photos/seed/rezics-loading/640/360?delay=4000",
    width: 640,
    height: 360,
    alt: "Slow-loading image",
  },
};
