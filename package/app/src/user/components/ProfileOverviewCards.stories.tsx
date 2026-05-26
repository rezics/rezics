import type { ContentSearchDocument } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withRouter } from "@/stories/decorators/withRouter";
import {
  ProfileActivityCard,
  ProfilePinnedItemCard,
  ProfileStatLink,
} from "./ProfileOverviewCards";

const meta = {
  title: "Domain/User/ProfileOverviewCards",
  decorators: [withRouter],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pinnedItem: ContentSearchDocument = {
  id: "unit-pinned-library-notes",
  type: "BOOK",
  titles: ["Library notes across three cities"],
  subtitles: ["A reading log"],
  contentText: null,
  descriptionText:
    "A compact public notebook about library buildings, translation shelves, and the habits that make reading social.",
  summaries: [
    "A compact public notebook about library buildings, translation shelves, and the habits that make reading social.",
  ],
  descriptions: [],
  creditNames: ["Mei Lin"],
  subjectNames: [],
  subjectEntityIds: [],
  subjectKinds: [],
  subjectRoles: [],
  tagLabels: ["library", "reading"],
  aliasValues: [],
  tagIds: [],
  tagScores: {},
  realmIds: [],
  realmTagKeys: [],
  languages: ["en"],
  rating: "GENERAL",
  visibility: "PUBLIC",
  isLicensed: false,
  postKind: null,
  textLength: 48000,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-20T00:00:00.000Z",
  publishedAt: "2026-05-02T00:00:00.000Z",
  defaultLanguage: "en",
  coverUrl: null,
  userId: "user-alice",
  translations: [
    {
      language: "en",
      title: "Library notes across three cities",
      subtitle: "A reading log",
      summary:
        "A compact public notebook about library buildings, translation shelves, and the habits that make reading social.",
      description: null,
    },
  ],
};

export const StatCards: Story = {
  render: () => (
    <div className="grid max-w-md grid-cols-2 gap-2 bg-surface-canvas p-4">
      <ProfileStatLink
        label="Shelves"
        count={18}
        to="/user/user-alice/shelves"
      />
      <ProfileStatLink
        label="Content"
        count={124}
        to="/user/user-alice/content"
      />
      <ProfileStatLink
        label="Followers"
        count={4096}
        to="/user/user-alice/followers"
        variant="compact"
      />
      <ProfileStatLink
        label="Following"
        count={72}
        to="/user/user-alice/followers?filter=following"
        variant="compact"
      />
    </div>
  ),
};

export const PinnedItems: Story = {
  render: () => (
    <div className="grid max-w-2xl grid-cols-2 gap-3 bg-surface-canvas p-4 md:grid-cols-3">
      <ProfilePinnedItemCard item={pinnedItem} untitledLabel="Untitled" />
      <ProfilePinnedItemCard
        item={{
          ...pinnedItem,
          id: "unit-long-pinned-title",
          type: "SHELF",
          titles: [
            "Pinned shelf with a very long title that needs to clamp without stretching the grid card",
          ],
          translations: [],
        }}
        untitledLabel="Untitled"
      />
    </div>
  ),
};

export const RecentActivity: Story = {
  render: () => (
    <div className="flex max-w-2xl flex-col gap-2 bg-surface-canvas p-4">
      <ProfileActivityCard
        item={pinnedItem}
        untitledLabel="Untitled"
        dateLabel="5/20/2026"
      />
      <ProfileActivityCard
        item={{
          ...pinnedItem,
          id: "unit-cjk-activity",
          type: "REVIEW",
          titles: ["閱讀筆記：公共圖書館與城市記憶"],
          translations: [],
        }}
        untitledLabel="Untitled"
        dateLabel="5/18/2026"
      />
    </div>
  ),
};
