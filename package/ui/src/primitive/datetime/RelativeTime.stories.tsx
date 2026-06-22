import type { Meta, StoryObj } from "@storybook/react-vite";
import { RelativeTime } from "./RelativeTime";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Stamp offsets at module load; stories read "x ago" relative to now.
// 模块加载时记下偏移；故事按相对当前时间显示「x 前」。
const now = Date.now();

const meta = {
  title: "Primitive/DateTime/RelativeTime",
  component: RelativeTime,
  args: { value: new Date(now - 5 * MINUTE).toISOString() },
} satisfies Meta<typeof RelativeTime>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A single timestamp; hover to see the absolute date in the tooltip. */
/** 单个时间；悬停可在 tooltip 看到绝对时间。 */
export const Default: Story = {};

/** The full best-fit ladder, proving identical wording across every bucket. */
/** 完整的最佳单位阶梯，证明每个档位措辞一致。 */
export const Ladder: Story = {
  render: () => (
    <ul className="flex flex-col gap-2 text-sm text-text-secondary">
      {[
        ["just now", now - 10_000],
        ["minutes", now - 5 * MINUTE],
        ["hours", now - 3 * HOUR],
        ["days", now - 2 * DAY],
        ["weeks", now - 3 * 7 * DAY],
        ["future", now + 5 * MINUTE],
      ].map(([label, ts]) => (
        <li key={label} className="flex gap-3">
          <span className="w-20 shrink-0 text-text-tertiary">{label}</span>
          <RelativeTime value={ts as number} />
        </li>
      ))}
    </ul>
  ),
};

/** Unparseable input renders nothing rather than "Invalid Date". */
/** 无法解析的输入渲染为空，而非 "Invalid Date"。 */
export const Invalid: Story = {
  args: { value: "not-a-date" },
};
