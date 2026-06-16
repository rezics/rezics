import type { ShelfView } from "@rezics/api/shelf";
import { shelfKeys } from "@rezics/api/shelf/shelf.keys";
import type {
  BookDTO,
  PostDTO,
  ShelfDTO,
  ShelfItemChildDTO,
  ShelfItemDTO,
} from "@rezics/contract";
import { markdownContentDoc } from "@rezics/contract";
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
// MOCK：仅用于 story 的 shelf + book fixtures，使该 section 无需网络即可渲染。
// 真实流程通过 shelfItemsQuery 和 hydration useQueries 缓存加载它们；这里两者都预填充。
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
    author: { unitId: "story-user", name: "Story Curator" },
    title,
    content: markdownContentDoc(`Body for ${title}.`),
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

function makeUnit(
  unitId: string,
  kind: ShelfItemDTO["kind"],
  position: string,
  createdAt?: string,
): ShelfItemDTO {
  return {
    shelfId: SHELF_ID,
    itemType: "unit",
    itemId: unitId,
    kind,
    position,
    ...(createdAt ? { createdAt } : {}),
  };
}

function makeBookUnit(idx: number): ShelfItemDTO {
  return makeUnit(`fixture-book-${idx}`, "book", String(idx).padStart(4, "0"));
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
  units: ShelfItemDTO[];
  relations: ShelfItemChildDTO[];
  books: BookDTO[];
  posts?: PostDTO[];
  shelves?: ShelfDTO[];
  tags?: ReturnType<typeof makeTag>[];
}

function useSeededShelf({
  units,
  relations,
  books,
  posts = [],
  shelves = [],
  tags = [],
}: SeedOptions) {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData(shelfKeys.itemsPage(SHELF_ID, undefined), {
      units,
      relations,
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
  }, [qc, units, relations, books, posts, shelves, tags]);
}

interface StoryShellProps {
  itemCount: number;
  viewMode: ShelfView;
  enqueue?: "single" | "dirtyMany" | "failedRetry";
  mixed?: boolean;
}

function StoryShell({ itemCount, viewMode, enqueue, mixed }: StoryShellProps) {
  const units = useMemo<ShelfItemDTO[]>(() => {
    if (!mixed) {
      return Array.from({ length: itemCount }, (_, i) => makeBookUnit(i + 1));
    }
    return [
      makeBookUnit(1),
      makeUnit(
        "fixture-review-1",
        "review",
        "0002",
        "2026-02-01T00:00:00.000Z",
      ),
      makeUnit(
        "fixture-shelf-nested",
        "shelf",
        "0003",
        "2026-02-02T00:00:00.000Z",
      ),
      makeUnit("fixture-tag-1", "tag", "0004", "2026-02-03T00:00:00.000Z"),
      makeBookUnit(5),
      makeUnit(
        "fixture-review-attached",
        "review",
        "0005~00",
        "2026-02-04T00:00:00.000Z",
      ),
    ];
  }, [itemCount, mixed]);
  const relations = useMemo<ShelfItemChildDTO[]>(() => {
    if (!mixed) return [];
    return [
      {
        shelfId: SHELF_ID,
        parentItemId: "fixture-book-5",
        childItemId: "fixture-review-attached",
        role: "review",
      },
      {
        shelfId: SHELF_ID,
        parentItemId: "fixture-book-5",
        childItemId: "fixture-tag-1",
        role: "tag",
      },
    ];
  }, [mixed]);
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
  useSeededShelf({ units, relations, books, posts, shelves, tags });

  const editor = useShelfItemsEditor(SHELF_ID);
  const shelf = useMemo(() => makeShelf(), []);
  const [currentViewMode, setCurrentViewMode] = useState<ShelfView>(viewMode);

  useEffect(() => {
    setCurrentViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!enqueue) return;
    if (editor.units.length === 0) return;
    if (editor.pendingCount > 0) return;
    if (enqueue === "single") {
      editor.enqueueDelete(editor.units[0]!.itemId);
      return;
    }
    if (enqueue === "dirtyMany") {
      editor.enqueueDelete(editor.units[0]!.itemId);
      if (editor.units[1])
        editor.enqueueReorder(editor.units[1].itemId, {
          before: editor.units[2]?.position,
          after: editor.units[3]?.position,
        });
      if (editor.units[2]) editor.enqueueDelete(editor.units[2].itemId);
      return;
    }
    if (enqueue === "failedRetry") {
      editor.enqueueDelete(editor.units[0]!.itemId);
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
// MOCK：storybook 路由桩。该 section 内嵌的 UnitPicker 会调用
// useRouter().getMatchedRoutes()；这里声明相同的承载 unit 的路由
// 模板，使解析命中时不会崩溃。
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
