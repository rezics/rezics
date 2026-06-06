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
import {
  compareRevisionPathSnapshots,
  compareRevisionSlots,
  type HistoryCompareResult,
} from "../models/historyCompare";
import {
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
type MarkdownCompareFixtureArgs = React.ComponentProps<
  typeof MarkdownCompareFixture
>;
type MarkdownDiffStory = StoryObj<typeof MarkdownCompareFixture>;

const markdownDiffArgTypes = {
  after: { control: "textarea" },
  before: { control: "textarea" },
  mode: { control: "select", options: ["unified", "split"] },
  path: { control: "text" },
} satisfies MarkdownDiffStory["argTypes"];

const englishMarkdownBefore = [
  "# The Quiet Library",
  "",
  "A room keeps the books we forget.",
  "Readers leave notes in the margins before dusk.",
  "",
  "- Lanterns stay low",
  "- The west shelf remains closed",
].join("\n");

const englishMarkdownAfter = [
  "# The Quiet Library",
  "",
  "A room keeps the books we forget and return to.",
  "Readers leave notes in the margins after the rain.",
  "",
  "- Lanterns stay low",
  "- The west shelf opens for winter readers",
  "- A new archive desk records borrowed titles",
].join("\n");

const chineseMarkdownBefore = [
  "## 靜謐圖書館",
  "",
  "城市把書留在光裡。",
  "讀者沿著長桌坐下，記下今天還沒有說出口的句子。",
  "",
  "- 窗邊保存舊報紙",
  "- 閉館鐘聲在七點響起",
].join("\n");

const chineseMarkdownAfter = [
  "## 靜謐圖書館",
  "",
  "城市把書留在午後的光裡。",
  "讀者沿著長桌坐下，記下今天終於能說出口的句子。",
  "",
  "- 窗邊保存舊報紙",
  "- 閉館鐘聲延後到八點響起",
  "- 新增的閱覽卡標出每本書回家的路",
].join("\n");

const japaneseMarkdownBefore = [
  "## 静かな図書館",
  "",
  "読書室は記憶を保存する。",
  "古い机には、返却日だけが小さく残っている。",
  "",
  "- 北側の棚は閉じたまま",
  "- 司書は夕方に記録を終える",
].join("\n");

const japaneseMarkdownAfter = [
  "## 静かな図書館",
  "",
  "読書室は記憶と余白を保存する。",
  "古い机には、返却日と次の読者の名前が小さく残っている。",
  "",
  "- 北側の棚は冬のあいだ開かれる",
  "- 司書は夜にも記録を続ける",
  "- 新しい目録カードが追加された",
].join("\n");

const largeHunkBefore = Array.from(
  { length: 28 },
  (_, index) => `Line ${index + 1}: unchanged archive note.`,
).join("\n");

const largeHunkAfter = Array.from({ length: 28 }, (_, index) =>
  index === 14
    ? "Line 15: a newly restored reading-room note."
    : `Line ${index + 1}: unchanged archive note.`,
).join("\n");

function StoryShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>;
}

function CompareResultFixture({
  compare,
  mode,
}: {
  compare: HistoryCompareResult;
  mode: "split" | "unified";
}) {
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
  return <CompareResultFixture compare={compare} mode={mode} />;
}

function MarkdownCompareFixture({
  after,
  before,
  mode = "unified",
  path,
}: {
  after: string;
  before: string;
  mode?: "split" | "unified";
  path: string;
}) {
  const compare = compareRevisionPathSnapshots({
    unitId: historyBookId,
    baseSequence: 1,
    targetSequence: 2,
    candidatePaths: [path],
    changes: [
      {
        path,
        base: { value: before, sequence: 1 },
        target: { value: after, sequence: 2 },
      },
    ],
  });

  return <CompareResultFixture compare={compare} mode={mode} />;
}

function renderMarkdownCompareFixture(args: MarkdownCompareFixtureArgs) {
  return <MarkdownCompareFixture {...args} />;
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

export const EnglishMarkdownDiff: MarkdownDiffStory = {
  render: renderMarkdownCompareFixture,
  argTypes: markdownDiffArgTypes,
  args: {
    path: "translations.en.description",
    before: englishMarkdownBefore,
    after: englishMarkdownAfter,
    mode: "unified",
  },
};

export const ChineseMarkdownDiff: MarkdownDiffStory = {
  render: renderMarkdownCompareFixture,
  argTypes: markdownDiffArgTypes,
  args: {
    path: "translations.zh-Hant.description",
    before: chineseMarkdownBefore,
    after: chineseMarkdownAfter,
    mode: "unified",
  },
};

export const JapaneseMarkdownDiff: MarkdownDiffStory = {
  render: renderMarkdownCompareFixture,
  argTypes: markdownDiffArgTypes,
  args: {
    path: "translations.ja.description",
    before: japaneseMarkdownBefore,
    after: japaneseMarkdownAfter,
    mode: "unified",
  },
};

export const LongProseSplitDiff: Story = {
  render: () => (
    <CompareFixture fixture={historyCompareFixtures.longProse} mode="split" />
  ),
};

export const LargeHunkDiff: MarkdownDiffStory = {
  render: renderMarkdownCompareFixture,
  argTypes: markdownDiffArgTypes,
  args: {
    path: "translations.en.description",
    before: largeHunkBefore,
    after: largeHunkAfter,
    mode: "unified",
  },
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
