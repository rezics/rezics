import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./carousel";

const meta = {
  title: "Primitives/Carousel",
  component: Carousel,
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Carousel className="w-full max-w-md">
      <CarouselContent>
        {Array.from({ length: 5 }).map((_, i) => (
          <CarouselItem key={i}>
            <div className="flex aspect-video items-center justify-center rounded-md bg-surface-subtle text-3xl font-serif text-text-primary">
              {i + 1}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const MultiPerView: Story = {
  render: () => (
    <Carousel className="w-full max-w-2xl" opts={{ align: "start" }}>
      <CarouselContent>
        {Array.from({ length: 8 }).map((_, i) => (
          <CarouselItem key={i} className="md:basis-1/3">
            <div className="flex aspect-square items-center justify-center rounded-md bg-surface-subtle">
              Cover {i + 1}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
