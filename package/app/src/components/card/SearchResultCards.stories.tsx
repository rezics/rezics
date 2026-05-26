import { Badge } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { unitHref } from "@/shared/ui/link";
import { withRouter } from "@/stories/decorators/withRouter";
import { userAlice, userBen } from "@/stories/fixtures/user";
import { SearchContentResultCard } from "./SearchContentResultCard";
import { SearchLibraryUnitCard } from "./SearchLibraryUnitCard";

const meta = {
  title: "App/Components/Card/SearchResultCards",
  component: SearchContentResultCard,
  decorators: [withRouter],
} satisfies Meta<typeof SearchContentResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContentSmallMedia: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        user={{
          ...userAlice,
          slug: "alice-mei",
          description:
            "Curates slow-reading shelves and posts careful notes on translation, memory, and public libraries.",
          isFollowing: false,
        }}
        time="May 12, 2026"
        kind="Review"
        source="海邊的卡夫卡"
        sourceHref={unitHref({
          type: "BOOK",
          unitId: "book-kafka-on-the-shore",
          slug: null,
        })}
        title="The last chapter changes how the whole book listens"
        titleHref={unitHref({
          type: "BOOK",
          unitId: "book-kafka-on-the-shore",
          slug: null,
        })}
        body="The last chapter looks quiet on first read, but it rearranges every earlier scene. The point is not the twist; it is the delayed recognition that every minor conversation has been teaching the reader how to listen."
        meta="73 votes · 12 comments"
        thumbnailSlot={
          <div className="h-full w-full bg-surface-sunken" aria-hidden="true" />
        }
      />
    </div>
  ),
};

export const ContentTextOnly: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        user={{
          ...userBen,
          slug: "ben-zhao",
        }}
        time="May 9, 2026"
        kind="Quote"
        source="A Library of Unfinished Futures · chapter 12"
        sourceHref={unitHref({
          type: "BOOK",
          unitId: "book-unfinished-futures",
          slug: null,
        })}
        body="A library is not a room. It is a set of unfinished futures."
        meta="Saved by 18 readers"
      />
    </div>
  ),
};

export const LibraryUnit: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchLibraryUnitCard
        title="海邊的卡夫卡"
        titleHref={unitHref({
          type: "BOOK",
          unitId: "book-kafka-on-the-shore",
          slug: null,
        })}
        subtitle="村上春樹 · 長篇小說"
        description="一個少年離家出走，另一個老人能與貓交談。兩條敘事線慢慢靠近，直到現實與神話開始互相解釋。"
        meta="Book · 1,248 reviews · 42 shelves"
        badge={<Badge variant="secondary">Book</Badge>}
        imageSlot={
          <div className="h-full w-full bg-brand-fill" aria-hidden="true" />
        }
      />
    </div>
  ),
};
