import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "@/stories/decorators/withRouter";
import {
  historyActors,
  historyBookId,
  historyCompareFixtures,
  historyEmptyRevisions,
  historyLaggingRevisions,
  historyReferences,
  historyRevisions,
  historyStructureEvents,
} from "@/stories/fixtures/history";
import { compareRevisionSlots } from "../models/historyCompare";
import {
  AuthorityPanel,
  CompareChange,
  RevisionTimeline,
  StructureTimeline,
} from "./BookHistoryPage";

const meta = {
  title: "Domain/Book/History",
  decorators: [withRouter],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function StoryShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>;
}

function CompareFixture({
  allowRaw = false,
  fixture,
  mode = "unified",
}: {
  allowRaw?: boolean;
  fixture: { before: Record<string, unknown>; after: Record<string, unknown> };
  mode?: "split" | "unified";
}) {
  const compare = compareRevisionSlots(fixture.before, fixture.after, {
    allowRaw,
  });
  return (
    <StoryShell>
      <section className="grid gap-5">
        {compare.changes.map((change) => (
          <section
            key={change.path}
            className="grid gap-3 border-t border-border-whisper pt-4"
          >
            <h3 className="text-sm font-medium leading-ui text-text-primary">
              {change.path}
            </h3>
            <CompareChange
              change={change}
              mode={mode}
              references={historyReferences}
            />
          </section>
        ))}
      </section>
    </StoryShell>
  );
}

export const EditorialTimeline: Story = {
  render: () => (
    <StoryShell>
      <RevisionTimeline
        bookId={historyBookId}
        revisions={historyRevisions}
        actors={historyActors}
        onRestore={() => undefined}
      />
    </StoryShell>
  ),
};

export const EmptyHistory: Story = {
  render: () => (
    <StoryShell>
      <RevisionTimeline
        bookId={historyBookId}
        revisions={historyEmptyRevisions}
        actors={historyActors}
        onRestore={() => undefined}
      />
    </StoryShell>
  ),
};

export const IngestionLag: Story = {
  render: () => (
    <StoryShell>
      <RevisionTimeline
        bookId={historyBookId}
        revisions={historyLaggingRevisions}
        actors={historyActors}
        onRestore={() => undefined}
      />
    </StoryShell>
  ),
};

export const StructureBatch: Story = {
  render: () => (
    <StoryShell>
      <StructureTimeline
        events={historyStructureEvents}
        actors={historyActors}
      />
    </StoryShell>
  ),
};

export const Authority: Story = {
  render: () => (
    <StoryShell>
      <AuthorityPanel />
    </StoryShell>
  ),
};

export const EnglishMarkdownDiff: Story = {
  render: () => <CompareFixture fixture={historyCompareFixtures.english} />,
};

export const ChineseMarkdownDiff: Story = {
  render: () => <CompareFixture fixture={historyCompareFixtures.chinese} />,
};

export const JapaneseMarkdownDiff: Story = {
  render: () => <CompareFixture fixture={historyCompareFixtures.japanese} />,
};

export const LongProseSplitDiff: Story = {
  render: () => (
    <CompareFixture fixture={historyCompareFixtures.longProse} mode="split" />
  ),
};

export const LargeHunkDiff: Story = {
  render: () => (
    <CompareFixture fixture={historyCompareFixtures.largeCollapsedHunk} />
  ),
};

export const ProductSafeUnknownSlot: Story = {
  render: () => (
    <CompareFixture fixture={historyCompareFixtures.rawAuthorized} />
  ),
};

export const AuthorizedRawFixture: Story = {
  render: () => (
    <CompareFixture fixture={historyCompareFixtures.rawAuthorized} allowRaw />
  ),
};
