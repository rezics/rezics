import { useTranslation } from "@rezics/i18n/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { BookCarousel } from "./HomeCarousel";

type Args = { autoplayIntervalNum: number };

const meta = {
  title: "App/Home/BookCarousel",
  component: BookCarousel,
  args: { autoplayIntervalNum: 3000 },
  argTypes: {
    autoplayIntervalNum: {
      control: { type: "range", min: 500, max: 8000, step: 500 },
    },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

function Render({ autoplayIntervalNum }: Args) {
  const { t } = useTranslation(["shell"]);
  return (
    <div className="p-4 max-w-14/16 mx-auto">
      <h3 className="mb-4 text-lg font-semibold">
        {t("shell:home_story_carousel_title")}
      </h3>
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="mb-4">
          <p className="text-sm font-medium">
            {t("shell:home_story_current_settings")}
          </p>
          <ul className="mt-2 text-sm space-y-1">
            <li>
              <strong>{t("shell:home_story_autoplay_interval")}</strong>{" "}
              {autoplayIntervalNum}ms
            </li>
          </ul>
        </div>
        <div className="bg-white rounded-lg shadow-sm">
          <div className="text-purple w-2/3 p-4 flex-none">
            <BookCarousel autoplayIntervalNum={autoplayIntervalNum} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: (args) => <Render {...args} />,
};

export const FastPlayback: Story = {
  args: { autoplayIntervalNum: 1000 },
  render: (args) => <Render {...args} />,
};

export const SlowPlayback: Story = {
  args: { autoplayIntervalNum: 5000 },
  render: (args) => <Render {...args} />,
};
