import { Badge } from "@rezics/ui/shadcn";
import type { Meta, StoryObj } from "@storybook/react-vite";
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
        sourceHref="/book/book-kafka-on-the-shore"
        title="The last chapter changes how the whole book listens"
        titleHref="/review/review-kafka-listening"
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
        sourceHref="/book/book-unfinished-futures"
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
        titleHref="/book/book-kafka-on-the-shore"
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

export const ShelfResult: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        kind="Shelf"
        title="Books for slow, public afternoons"
        titleHref="/shelf/shelf-slow-public-afternoons"
        body="A small reading path through libraries, train stations, letters, and books that understand waiting."
        meta="Shelf · 18 units · Updated May 18, 2026"
        badge={<Badge variant="secondary">Shelf</Badge>}
      />
    </div>
  ),
};

export const RealmResult: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        kind="Realm"
        title="City Library Readers"
        titleHref="/realm/realm-city-library-readers"
        body="A public realm for readers comparing municipal library systems, translation collections, and community reading programs."
        meta="1,284 members"
        badge={<Badge variant="secondary">Realm</Badge>}
      />
    </div>
  ),
};

export const UserResult: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        user={{
          ...userAlice,
          slug: "alice-mei",
          summary:
            "Reads translation notes, public library histories, and anything with careful marginalia.",
          followersCount: 428,
          followingsCount: 90,
        }}
        kind="User"
        body="Reads translation notes, public library histories, and anything with careful marginalia."
        meta="428 followers"
        badge={<Badge variant="secondary">User</Badge>}
      />
    </div>
  ),
};

export const EntityResult: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        avatar={{
          fallback: "林",
          alt: "林少華",
        }}
        kind="Translator"
        title="林少華"
        titleHref="/entity/entity-lin-shaohua"
        body="Translator and scholar associated with Chinese translations of modern Japanese literature."
        meta="Entity · Verified"
        badge={<Badge variant="secondary">Entity</Badge>}
      />
    </div>
  ),
};

export const LongTextClamp: Story = {
  render: () => (
    <div className="max-w-[45.75rem] bg-surface-canvas p-4">
      <SearchContentResultCard
        kind="Remark"
        source="A deliberately long source title that should stay inside one card row without pushing the action area out of place"
        title="A very long mixed-language title 測試搜尋結果標題在多語內容中的換行與截斷行為"
        body="This search result body intentionally runs long so the preview surface demonstrates clamping. It includes enough prose to overflow several lines while keeping the card height stable and the metadata row available for scanning."
        meta="Remark · Updated May 20, 2026 · Search metadata should truncate cleanly"
        thumbnailSlot={
          <div className="h-full w-full bg-surface-sunken" aria-hidden="true" />
        }
      />
    </div>
  ),
};
