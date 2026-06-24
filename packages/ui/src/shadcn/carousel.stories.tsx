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

const defaultSlides = ["1", "2", "3", "4", "5"];
const coverSlides = [
  "Cover 1",
  "Cover 2",
  "Cover 3",
  "Cover 4",
  "Cover 5",
  "Cover 6",
  "Cover 7",
  "Cover 8",
];

export const Default: Story = {
  render: () => (
    <Carousel className="w-full max-w-md">
      <CarouselContent>
        {defaultSlides.map((slide) => (
          <CarouselItem key={slide}>
            <div className="flex aspect-video items-center justify-center rounded-md bg-surface-subtle text-3xl font-serif text-text-primary">
              {slide}
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
        {coverSlides.map((slide) => (
          <CarouselItem key={slide} className="md:basis-1/3">
            <div className="flex aspect-square items-center justify-center rounded-md bg-surface-subtle">
              {slide}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
