import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "#/shadcn/carousel";
import { CarouselIndicator } from "./CarouselIndicator";

interface CarouselIndicatorPreviewProps {
  variant?: "dots" | "text";
  position?: "overlay" | "bottom";
  align?: "center" | "left" | "right";
  itemCount?: number;
}

function CarouselIndicatorPreview({
  variant = "dots",
  position = "overlay",
  align = "center",
  itemCount = 5,
}: CarouselIndicatorPreviewProps) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  return (
    <div className="relative w-[480px]">
      <Carousel setApi={setApi} opts={{ align: "start" }}>
        <CarouselContent>
          {Array.from({ length: itemCount }).map((_, index) => (
            <CarouselItem
              // biome-ignore lint/suspicious/noArrayIndexKey: static demo list
              key={index}
              className="basis-full"
            >
              <div className="h-48 rounded-2xl bg-gradient-to-br from-rose-200 to-amber-100 flex items-center justify-center text-4xl font-semibold text-rose-700">
                {index + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <CarouselIndicator
        api={api}
        variant={variant}
        position={position}
        align={align}
      />
    </div>
  );
}

const meta = {
  title: "Primitive/Carousel/CarouselIndicator",
  component: CarouselIndicatorPreview,
  args: {
    variant: "dots",
    position: "overlay",
    align: "center",
    itemCount: 5,
  },
} satisfies Meta<typeof CarouselIndicatorPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Text: Story = {
  args: { variant: "text" },
};

export const Bottom: Story = {
  args: { position: "bottom" },
};

export const AlignLeft: Story = {
  args: { align: "left" },
};
