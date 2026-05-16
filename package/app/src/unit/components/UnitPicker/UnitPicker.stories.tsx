import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Button } from "@rezics/ui/shadcn";
import { unitKeys } from "@rezics/api/unit/unit.keys";
import type {
  UnitDTO,
  UnitListResponse,
  UnitResponse,
} from "@rezics/contract";
import { useEffect, useMemo, useState } from "react";
import type { Candidate } from "../../models/types";
import { UnitPicker } from "./UnitPicker";

// MOCK: fixture units for storybook cache hydration.
const fixtureBook: UnitDTO = {
  id: "book-abc",
  type: "book",
  translations: [
    {
      unitId: "book-abc",
      language: "en",
      title: "The Demo Book",
    },
  ],
  defaultLanguage: "en",
};

const fixtureChapter: UnitDTO = {
  id: "chapter-xyz",
  type: "chapter",
  workUnitId: "book-abc",
  translations: [
    {
      unitId: "chapter-xyz",
      language: "en",
      title: "Chapter 1: Beginnings",
    },
  ],
  defaultLanguage: "en",
};

const fixtureSubUnits: UnitDTO[] = [
  fixtureChapter,
  {
    id: "chapter-2",
    type: "chapter",
    workUnitId: "book-abc",
    translations: [
      { unitId: "chapter-2", language: "en", title: "Chapter 2: Middle" },
    ],
    defaultLanguage: "en",
  },
  {
    id: "chapter-3",
    type: "chapter",
    workUnitId: "book-abc",
    translations: [
      { unitId: "chapter-3", language: "en", title: "Chapter 3: End" },
    ],
    defaultLanguage: "en",
  },
];

function useHydrateUnitCache() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData<UnitResponse>(unitKeys.detail("book-abc"), fixtureBook);
    qc.setQueryData<UnitResponse>(
      unitKeys.detail("chapter-xyz"),
      fixtureChapter,
    );
    qc.setQueryData<UnitListResponse>(
      unitKeys.list({ workUnitId: "book-abc", limit: 100 }),
      { units: fixtureSubUnits, total: fixtureSubUnits.length },
    );
  }, [qc]);
}

interface StoryShellProps {
  initialInput?: string;
  workContextUnitId?: string;
  mode: "single" | "multi";
}

function StoryShell({ initialInput, workContextUnitId, mode }: StoryShellProps) {
  useHydrateUnitCache();
  const [selected, setSelected] = useState<Candidate | undefined>(undefined);
  const [added, setAdded] = useState<Candidate[]>([]);

  const renderItemAction =
    mode === "single"
      ? (candidate: Candidate) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSelected(candidate)}
          >
            Use this
          </Button>
        )
      : (candidate: Candidate) => (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdded((prev) => [...prev, candidate])}
          >
            Add
          </Button>
        );

  return (
    <div className="max-w-xl flex flex-col gap-4">
      <UnitPicker
        initialInput={initialInput}
        workContextUnitId={workContextUnitId}
        renderItemAction={renderItemAction}
      />
      <div className="text-xs text-text-secondary border-t border-border-whisper pt-2">
        {mode === "single" ? (
          <span>
            selected:{" "}
            {selected
              ? `${selected.kind}:${selected.identifier}`
              : "(none yet)"}
          </span>
        ) : (
          <span>added: {added.length} item(s)</span>
        )}
      </div>
    </div>
  );
}

// MOCK: storybook router stub. Declares route templates with unit-bearing
// params so router.getMatchedRoutes() returns realistic results for the
// stories' initialInput values.
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
    const unitIdRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/unit/$unitId",
    });
    return createRouter({
      routeTree: rootRoute.addChildren([
        bookRoute.addChildren([chapterRoute]),
        shelfRoute,
        unitIdRoute,
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
  title: "App/Unit/UnitPicker",
  component: StoryShell,
  decorators: [withStoryRouter],
} satisfies Meta<typeof StoryShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSelectExcerptStyle: Story = {
  args: {
    mode: "single",
    initialInput: "/book/book-abc/read/chapter-xyz",
  },
};

export const MultiAddShelfStyle: Story = {
  args: {
    mode: "multi",
    initialInput: "/book/book-abc/read/chapter-xyz",
  },
};

export const ParseError: Story = {
  args: {
    mode: "single",
    initialInput: "not-a-valid-url",
  },
};

export const BrowsePanelPopulated: Story = {
  args: {
    mode: "multi",
    workContextUnitId: "book-abc",
    initialInput: "",
  },
};
