import type {
  BookDTO,
  PostDTO,
  ShelfDTO,
  ShelfItemDTO,
} from "@rezics/contract";
import { shelfKeys } from "@rezics/api/shelf/shelf.keys";
import type { ShelfView } from "@rezics/api/shelf";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useShelfItemsEditor } from "../hooks/useShelfItemsEditor";
import { ShelfEditorItemsSection } from "./ShelfEditorItemsSection";

const SHELF_ID = "fixture-shelf-1";

// MOCK: story-only shelf + book fixtures so the section renders without
// network. The real flow loads these via shelfItemsQuery and the hydration
// useQueries cache; we pre-populate both.
function makeBook(idx: number): BookDTO {
  const id = `fixture-book-${idx}`;
  return {
    unitId: id,
    coverUrl: idx === 2 ? null : `https://picsum.photos/seed/${id}/120/180`,
    translations: [
      {
        unitId: id,
        language: "en",
        title:
          idx === 3
            ? "Fixture Book With A Very Long Title That Must Stay In A Fixed Unit Row"
            : `Fixture Book ${idx}`,
        description:
          idx === 3
            ? "A deliberately long synopsis that should clamp inside the unit view without shifting neighboring rows during drag or sort operations."
            : `Synopsis for book ${idx}.`,
      },
    ],
    defaultLanguage: "en",
  } as unknown as BookDTO;
}

function makePost(id: string, title: string): PostDTO {
  return {
    unitId: id,
    authorUserId: "story-user",
    author: { userId: "story-user", name: "Story Curator" },
    body: `Body for ${title}.`,
    extra: { title },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeNestedShelf(): ShelfDTO {
  return {
    unitId: "fixture-shelf-nested",
    userId: "story-user",
    translations: [
      {
        unitId: "fixture-shelf-nested",
        language: "en",
        title: "Nested shelf fixture",
        description: "A shelf rendered through the unit row adapter.",
      },
    ],
    itemCount: 3,
    extra: { viewMode: "nested" },
  } as unknown as ShelfDTO;
}

function makeTag() {
  return {
    unitId: "fixture-tag-1",
    slug: "translation",
    label: "Translation",
    translations: [{ language: "en", title: "Translation" }],
  };
}

function makeItem(idx: number): ShelfItemDTO {
  const ref = `fixture-book-${idx}`;
  return {
    shelfUnitId: SHELF_ID,
    itemRef: ref,
    kind: "book",
    position: String(idx).padStart(4, "0"),
    reviewIds: [],
    tagIds: [],
  };
}

function makeShelf(): ShelfDTO {
  return {
    unitId: SHELF_ID,
    userId: "story-user",
    translations: [
      { unitId: SHELF_ID, language: "en", title: "Fixture shelf" },
    ],
    extra: { viewMode: "nested" },
  } as unknown as ShelfDTO;
}

interface SeedOptions {
  items: ShelfItemDTO[];
  books: BookDTO[];
  posts?: PostDTO[];
  shelves?: ShelfDTO[];
  tags?: ReturnType<typeof makeTag>[];
}

function useSeededShelf({
  items,
  books,
  posts = [],
  shelves = [],
  tags = [],
}: SeedOptions) {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData(shelfKeys.itemsPage(SHELF_ID, undefined), {
      items,
      hasMore: false,
    });
    const ids = books.map((b) => b.unitId);
    qc.setQueryData(
      ["shelf-hydration", "book", [...ids].sort().join(",")],
      books,
    );
    const postIds = posts.map((post) => post.unitId);
    qc.setQueryData(
      ["shelf-hydration", "post", [...postIds].sort().join(",")],
      posts,
    );
    const shelfIds = shelves.map((shelf) => shelf.unitId);
    qc.setQueryData(
      ["shelf-hydration", "shelf", [...shelfIds].sort().join(",")],
      shelves,
    );
    const tagIds = tags.map((tag) => tag.unitId);
    qc.setQueryData(
      ["shelf-hydration", "tag", [...tagIds].sort().join(",")],
      tags,
    );
  }, [qc, items, books, posts, shelves, tags]);
}

interface StoryShellProps {
  itemCount: number;
  viewMode: ShelfView;
  enqueue?: "single" | "dirtyMany" | "failedRetry";
  mixed?: boolean;
}

function StoryShell({ itemCount, viewMode, enqueue, mixed }: StoryShellProps) {
  const items = useMemo(() => {
    if (!mixed)
      return Array.from({ length: itemCount }, (_, i) => makeItem(i + 1));
    return [
      makeItem(1),
      {
        ...makeItem(2),
        itemRef: "fixture-review-1",
        kind: "review",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      {
        ...makeItem(3),
        itemRef: "fixture-shelf-nested",
        kind: "shelf",
        createdAt: "2026-02-02T00:00:00.000Z",
      },
      {
        ...makeItem(4),
        itemRef: "fixture-tag-1",
        kind: "tag",
        createdAt: "2026-02-03T00:00:00.000Z",
      },
      {
        ...makeItem(5),
        reviewIds: ["fixture-review-attached"],
        tagIds: ["fixture-tag-1"],
        createdAt: "2026-02-04T00:00:00.000Z",
      },
    ] satisfies ShelfItemDTO[];
  }, [itemCount, mixed]);
  const books = useMemo(
    () =>
      mixed
        ? [makeBook(1), makeBook(5)]
        : Array.from({ length: itemCount }, (_, i) => makeBook(i + 1)),
    [itemCount, mixed],
  );
  const posts = useMemo(
    () =>
      mixed
        ? [
            makePost("fixture-review-1", "Primary review row"),
            makePost("fixture-review-attached", "Attached review row"),
          ]
        : [],
    [mixed],
  );
  const shelves = useMemo(() => (mixed ? [makeNestedShelf()] : []), [mixed]);
  const tags = useMemo(() => (mixed ? [makeTag()] : []), [mixed]);
  useSeededShelf({ items, books, posts, shelves, tags });

  const editor = useShelfItemsEditor(SHELF_ID);
  const shelf = useMemo(() => makeShelf(), []);
  const [currentViewMode, setCurrentViewMode] = useState<ShelfView>(viewMode);

  useEffect(() => {
    setCurrentViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!enqueue) return;
    if (editor.items.length === 0) return;
    if (editor.pendingCount > 0) return;
    if (enqueue === "single") {
      editor.enqueueDelete(editor.items[0]!.itemRef);
      return;
    }
    if (enqueue === "dirtyMany") {
      editor.enqueueDelete(editor.items[0]!.itemRef);
      if (editor.items[1])
        editor.enqueueReorder(editor.items[1].itemRef, {
          before: editor.items[2]?.position,
          after: editor.items[3]?.position,
        });
      if (editor.items[2]) editor.enqueueDelete(editor.items[2].itemRef);
      return;
    }
    if (enqueue === "failedRetry") {
      editor.enqueueDelete(editor.items[0]!.itemRef);
    }
  }, [enqueue, editor]);

  return (
    <div className="max-w-3xl p-6">
      <ShelfEditorItemsSection
        shelf={shelf}
        viewMode={currentViewMode}
        onViewModeChange={setCurrentViewMode}
        editor={editor}
      />
    </div>
  );
}

// MOCK: storybook router stub. The section embeds UnitPicker which calls
// useRouter().getMatchedRoutes(); we declare the same unit-bearing route
// templates so parser hits don't blow up.
function StoryRouterHost({ children }: { children: React.ReactNode }) {
  const router = useMemo(() => {
    const rootRoute = createRootRoute({
      component: () => <>{children}</>,
    });
    const bookRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/book/$bookId",
    });
    const chapterRoute = createRoute({
      getParentRoute: () => bookRoute,
      path: "read/$chapterId",
    });
    const shelfRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/shelf/$shelfId",
    });
    return createRouter({
      routeTree: rootRoute.addChildren([
        bookRoute.addChildren([chapterRoute]),
        shelfRoute,
      ]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  }, [children]);
  return <RouterProvider router={router as never} />;
}

const withStoryRouter = (Story: React.ComponentType) => (
  <StoryRouterHost>
    <Story />
  </StoryRouterHost>
);

const meta = {
  title: "App/Shelf/ShelfEditorItemsSection",
  component: StoryShell,
  decorators: [withStoryRouter],
} satisfies Meta<typeof StoryShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyShelf: Story = {
  args: { itemCount: 0, viewMode: "nested" },
};

export const SinglePage: Story = {
  args: { itemCount: 5, viewMode: "nested" },
};

export const PaginatedMultiPage: Story = {
  args: { itemCount: 42, viewMode: "nested" },
};

export const DirtyWithPendingOps: Story = {
  args: { itemCount: 8, viewMode: "nested", enqueue: "dirtyMany" },
};

export const FlatViewMode: Story = {
  args: { itemCount: 5, viewMode: "flat", mixed: true },
};

export const SinglePendingOp: Story = {
  args: { itemCount: 5, viewMode: "nested", enqueue: "single" },
};

export const MultiSelectMode: Story = {
  args: { itemCount: 5, viewMode: "nested", mixed: true },
};

export const PreviewMode: Story = {
  args: { itemCount: 5, viewMode: "nested", mixed: true },
};
