import { DEFAULT_BOOKSHELF_CONFIG } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { withRouter } from "@/stories/decorators/withRouter";
import type { BookshelfItem } from "../models/types";
import { BookshelfGrid } from "./BookshelfGrid";
import { UseMySettingsButton } from "./UseMySettingsButton";

const COVER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";

const ITEMS: BookshelfItem[] = [
  {
    unitId: "b1",
    kind: "book",
    title: "Dune",
    author: "Frank Herbert",
    coverUrl: COVER,
    isLicensed: true,
    href: "/book/b1",
    chaptersCompleted: 3,
    chaptersTotal: 12,
    lastReadChapterTitle: "Arrakis",
  },
  {
    unitId: "b2",
    kind: "book",
    title: "Solaris",
    coverUrl: COVER,
    isLicensed: false,
    href: "/book/b2",
  },
  {
    unitId: "g1",
    kind: "game",
    title: "Outer Wilds",
    coverUrl: COVER,
    href: "/game/g1",
  },
];

const meta = {
  title: "App/BookshelfView/BookshelfGrid",
  component: BookshelfGrid,
  decorators: [withRouter],
} satisfies Meta<typeof BookshelfGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Renders one cover-card link per item using the default breakpoint config. */
export const Default: Story = {
  render: () => (
    <BookshelfGrid items={ITEMS} config={DEFAULT_BOOKSHELF_CONFIG} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getAllByRole("link")).toHaveLength(ITEMS.length),
    );
  },
};

/** Empty list renders the supplied empty state. */
export const Empty: Story = {
  render: () => (
    <BookshelfGrid
      items={[]}
      config={DEFAULT_BOOKSHELF_CONFIG}
      emptyState={<p>Nothing on this shelf yet.</p>}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Nothing on this shelf yet.")).toBeInTheDocument();
  },
};

/**
 * Desktop hover preview: hovering a cover reveals the preview panel, which
 * adds a second link to the same item detail.
 */
export const HoverPreview: Story = {
  render: () => (
    <BookshelfGrid items={ITEMS} config={DEFAULT_BOOKSHELF_CONFIG} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One link per cover before hover.
    expect(canvas.getAllByRole("link", { name: "Dune" })).toHaveLength(1);
    await userEvent.hover(canvas.getAllByRole("link", { name: "Dune" })[0]!);
    // The hover panel contributes a second link to the same detail page...
    await waitFor(() =>
      expect(canvas.getAllByRole("link", { name: "Dune" })).toHaveLength(2),
    );
    // ...and surfaces the viewer's last-read chapter title.
    expect(canvas.getByText("Arrakis")).toBeInTheDocument();
  },
};

type ResetStory = StoryObj<typeof UseMySettingsButton>;

/** Hidden when no URL override is active — nothing to reset. */
export const UseMySettingsHidden: ResetStory = {
  render: () => <UseMySettingsButton hasUrlOverride={false} onReset={fn()} />,
  play: async ({ canvasElement }) => {
    expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

const resetSpy = fn();

/** Active override: the button resets to the viewer's stored settings. */
export const UseMySettingsActive: ResetStory = {
  render: () => <UseMySettingsButton hasUrlOverride onReset={resetSpy} />,
  play: async ({ canvasElement }) => {
    resetSpy.mockClear();
    const button = within(canvasElement).getByRole("button");
    await userEvent.click(button);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  },
};
