import type { BookDTO, ShelfDTO, ShelfItemDTO } from "@rezics/contract";
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
import { useEffect, useMemo } from "react";
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
    coverUrl: `https://picsum.photos/seed/${id}/120/180`,
    translations: [
      {
        unitId: id,
        language: "en",
        title: `Fixture Book ${idx}`,
        description: `Synopsis for book ${idx}.`,
      },
    ],
    defaultLanguage: "en",
  } as unknown as BookDTO;
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
}

function useSeededShelf({ items, books }: SeedOptions) {
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
  }, [qc, items, books]);
}

interface StoryShellProps {
  itemCount: number;
  viewMode: ShelfView;
  enqueue?: "single" | "dirtyMany" | "failedRetry";
}

function StoryShell({ itemCount, viewMode, enqueue }: StoryShellProps) {
  const items = useMemo(
    () => Array.from({ length: itemCount }, (_, i) => makeItem(i + 1)),
    [itemCount],
  );
  const books = useMemo(
    () => Array.from({ length: itemCount }, (_, i) => makeBook(i + 1)),
    [itemCount],
  );
  useSeededShelf({ items, books });

  const editor = useShelfItemsEditor(SHELF_ID);
  const shelf = useMemo(() => makeShelf(), []);

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
        viewMode={viewMode}
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
  args: { itemCount: 5, viewMode: "flat" },
};

export const MasonryViewMode: Story = {
  args: { itemCount: 5, viewMode: "masonry" },
};

export const SinglePendingOp: Story = {
  args: { itemCount: 5, viewMode: "nested", enqueue: "single" },
};
