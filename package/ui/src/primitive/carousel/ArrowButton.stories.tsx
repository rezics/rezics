import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ArrowButton } from "./ArrowButton";

const meta = {
  title: "Primitive/Carousel/ArrowButton",
  component: ArrowButton,
  args: { icon: KeyboardArrowLeftIcon, className: "" },
} satisfies Meta<typeof ArrowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LeftRight: Story = {
  render: () => (
    <div className="p-4 space-x-4 flex items-center">
      <ArrowButton icon={KeyboardArrowLeftIcon} />
      <ArrowButton icon={KeyboardArrowRightIcon} />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-4">
        <ArrowButton
          icon={KeyboardArrowLeftIcon}
          className="h-8 w-8 text-[16px]"
        />
        <span>小尺寸 (16)</span>
      </div>
      <div className="flex items-center space-x-4">
        <ArrowButton icon={KeyboardArrowLeftIcon} className="text-[24px]" />
        <span>中等尺寸 (24)</span>
      </div>
      <div className="flex items-center space-x-4">
        <ArrowButton
          icon={KeyboardArrowLeftIcon}
          className="h-12 w-12 text-[32px]"
        />
        <span>大尺寸 (32)</span>
      </div>
    </div>
  ),
};

export const WithClassName: Story = {
  render: () => (
    <div className="p-4 space-x-4 flex items-center">
      <ArrowButton icon={KeyboardArrowLeftIcon} className="opacity-50" />
      <ArrowButton icon={KeyboardArrowRightIcon} className="opacity-50" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="p-4 space-x-4 flex items-center">
      <ArrowButton icon={KeyboardArrowLeftIcon} disabled />
      <ArrowButton icon={KeyboardArrowRightIcon} disabled />
    </div>
  ),
};
