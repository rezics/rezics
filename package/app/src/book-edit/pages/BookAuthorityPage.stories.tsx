import { UNIT_FIELD_LOCK_ALL, type UnitFieldLockDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "@/stories/decorators/withRouter";
import { historyBookId } from "@/stories/fixtures/history";
import { BookAuthorityPanel } from "./BookAuthorityPage";

const meta = {
  title: "Domain/Book/Edit/Authority",
  component: BookAuthorityPanel,
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof BookAuthorityPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

function lock(path: string, reason: string | null = null): UnitFieldLockDTO {
  return {
    unitId: historyBookId,
    path,
    reason,
    lockedById: "storybook-user",
    createdAt: "2026-05-20T10:10:00.000Z",
  };
}

function StoryShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>;
}

export const NoLocks: Story = {
  render: () => (
    <StoryShell>
      <BookAuthorityPanel
        unitId={historyBookId}
        canManageLocks
        initialLocks={[]}
      />
    </StoryShell>
  ),
};

export const FieldLock: Story = {
  render: () => (
    <StoryShell>
      <BookAuthorityPanel
        unitId={historyBookId}
        canManageLocks
        initialLocks={[
          lock("translations.en.title", "Keep the canonical title stable."),
          lock("credits.authors"),
        ]}
      />
    </StoryShell>
  ),
};

export const AllFieldsLock: Story = {
  render: () => (
    <StoryShell>
      <BookAuthorityPanel
        unitId={historyBookId}
        canManageLocks
        initialLocks={[lock(UNIT_FIELD_LOCK_ALL, "Personal work is closed.")]}
      />
    </StoryShell>
  ),
};
