import { unitKeys } from "@rezics/api/unit/unit.keys";
import type { UnitDTO, UnitResponse } from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
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
import type { Candidate } from "../../models/types";
import { UnitPicker } from "./UnitPicker";

// MOCK: fixture units for storybook cache hydration.
// MOCK：用于 storybook 缓存预填充的夹具单元。
const fixtureBook: UnitDTO = {
  id: "book-abc",
  type: "book",
  resolvedLanguage: "en",
  title: "The Demo Book",
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
  resolvedLanguage: "en",
  title: "Chapter 1: Beginnings",
  translations: [
    {
      unitId: "chapter-xyz",
      language: "en",
      title: "Chapter 1: Beginnings",
    },
  ],
  defaultLanguage: "en",
};

function useHydrateUnitCache() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData<UnitResponse>(unitKeys.detail("book-abc"), fixtureBook);
    qc.setQueryData<UnitResponse>(
      unitKeys.detail("chapter-xyz"),
      fixtureChapter,
    );
  }, [qc]);
}

interface StoryShellProps {
  initialInput?: string;
  mode: "single" | "multi";
}

function StoryShell({ initialInput, mode }: StoryShellProps) {
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
// MOCK：storybook 路由桩。声明带有 unit 参数的路由模板，使
// router.getMatchedRoutes() 针对各 story 的 initialInput 值返回真实结果。
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
