import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Input } from "./input";
import { Label } from "./label";

// Stable field numbers (1..16) so the demo list uses value-based keys.
// 稳定的字段序号（1..16），让演示列表使用基于值的 key。
const TALL_FORM_FIELDS = Array.from({ length: 16 }, (_, index) => index + 1);

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button />}>Edit shelf</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename shelf</DialogTitle>
          <DialogDescription>
            Give this shelf a name your future self will recognize.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label htmlFor="dialog-name">Name</Label>
          <Input id="dialog-name" defaultValue="Currently reading" />
        </div>
        <DialogFooter showCloseButton>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/**
 * A long form on a short viewport. The dialog caps its height to the viewport
 * and scrolls internally, so the footer's Save button stays reachable instead
 * of being pushed off the bottom of the screen. Open at a ≤700px-tall viewport
 * to verify the scroll happens inside the card.
 * 矮视口下的长表单。对话框把高度限制在视口内并内部滚动，于是页脚的 Save 按钮始终可达，
 * 不会被顶出屏幕底部。在 ≤700px 高的视口打开以验证滚动发生在卡片内部。
 */
export const TallContentShortViewport: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            A deliberately long form to force the dialog past the viewport
            height.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {TALL_FORM_FIELDS.map((n) => (
            <div key={`tall-field-${n}`} className="grid gap-1.5">
              <Label htmlFor={`tall-field-${n}`}>Field {n}</Label>
              <Input id={`tall-field-${n}`} placeholder={`Value ${n}`} />
            </div>
          ))}
        </div>
        <DialogFooter showCloseButton>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
