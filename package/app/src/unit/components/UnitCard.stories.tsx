import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@rezics/ui/shadcn";
import { withRouter } from "@/stories/decorators/withRouter";
import { UnitCard } from "./UnitCard";
import type { UnitCardSummary } from "../models/unitCardSummary";

const baseSummary: UnitCardSummary = {
  unitId: "book-1",
  kind: "book",
  title: "The Library at the Edge of Morning",
  subtitle: "Annotated edition",
  imageUrl: "https://picsum.photos/seed/unit-card-cover/160/240",
  contentPreview:
    "A concise archive note about editions, translation drift, and reading order.",
  author: {
    userId: "user-1",
    slug: "mina",
    name: "Mina Park",
    avatar: null,
    bio: "Curates library shelves and translation notes.",
  },
  addedAt: "2026-04-21T10:30:00.000Z",
};

const meta = {
  title: "App/Unit/UnitCard",
  component: UnitCard,
  decorators: [withRouter],
  parameters: {
    layout: "centered",
  },
  args: {
    summary: baseSummary,
  },
  render: (args) => (
    <div className="w-full max-w-xl">
      <UnitCard {...args} />
    </div>
  ),
} satisfies Meta<typeof UnitCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MissingImage: Story = {
  args: {
    summary: {
      ...baseSummary,
      unitId: "post-1",
      kind: "post",
      imageUrl: null,
    },
  },
};

export const LongText: Story = {
  args: {
    summary: {
      ...baseSummary,
      unitId: "long-1",
      title:
        "A Very Long Unit Title That Should Stay Inside One Stable Curation Row Without Expanding The Layout",
      contentPreview:
        "This preview intentionally runs long enough to test line clamping and stable row height across multiple languages, editions, notes, and curator metadata fields that would otherwise create layout shifts.",
      author: {
        userId: "long-user",
        name: "Alexandria Theodora Penelope Versewright-Liang",
      },
    },
  },
};

export const TranslationMetadata: Story = {
  args: {
    summary: {
      ...baseSummary,
      unitId: "translation-1",
      title: "輪回圖書館",
      translationMeta: {
        language: "zh-Hant",
        sourceTitle: "The Library at the Edge of Morning",
        overrideTitle: "輪回圖書館",
      },
    },
  },
};

export const ShelfAddedTime: Story = {
  args: {
    summary: {
      ...baseSummary,
      unitId: "added-1",
      addedAt: "2026-05-01T18:15:00.000Z",
    },
  },
};

export const AuthorPreview: Story = {
  args: {
    summary: baseSummary,
  },
};

export const WithAction: Story = {
  args: {
    summary: baseSummary,
    action: (
      <Button type="button" size="sm" variant="outline">
        Add
      </Button>
    ),
  },
};
