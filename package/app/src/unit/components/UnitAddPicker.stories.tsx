import { unitKeys } from "@rezics/api/unit/unit.keys";
import type { UnitDTO, UnitListResponse, UnitResponse } from "@rezics/contract";
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
import type { Candidate } from "../models/types";
import { UnitAddPicker } from "./UnitAddPicker";

const bookUnit: UnitDTO = {
  id: "book-abc",
  type: "BOOK",
  translations: [
    {
      unitId: "book-abc",
      language: "en",
      title: "The Demo Book",
      summary: "A searchable work used by the add-item composition.",
      extra: { coverUrl: "https://picsum.photos/seed/add-book/120/180" },
    },
  ],
  defaultLanguage: "en",
};

const chapterUnit: UnitDTO = {
  id: "chapter-xyz",
  type: "POST",
  translations: [
    {
      unitId: "chapter-xyz",
      language: "en",
      title: "Chapter 1: Beginnings",
      summary: "A related sub-unit.",
    },
  ],
  defaultLanguage: "en",
};

const searchUnits: UnitDTO[] = [
  bookUnit,
  {
    id: "review-1",
    type: "POST",
    translations: [
      {
        unitId: "review-1",
        language: "en",
        title: "A review of the demo book",
        summary: "Search result with no browse context.",
      },
    ],
    defaultLanguage: "en",
  },
];

function useHydrateUnitCache() {
  const qc = useQueryClient();
  useEffect(() => {
    qc.setQueryData<UnitListResponse>(unitKeys.search("demo", { limit: 8 }), {
      units: searchUnits,
      total: searchUnits.length,
    });
    qc.setQueryData<UnitListResponse>(
      unitKeys.search("missing", { limit: 8 }),
      { units: [], total: 0 },
    );
    qc.setQueryData<UnitResponse>(unitKeys.detail("book-abc"), bookUnit);
    qc.setQueryData<UnitResponse>(unitKeys.detail("chapter-xyz"), chapterUnit);
  }, [qc]);
}

interface StoryShellProps {
  initialSearchQuery?: string;
  initialUrlInput?: string;
}

function StoryShell({ initialSearchQuery, initialUrlInput }: StoryShellProps) {
  useHydrateUnitCache();
  const [added, setAdded] = useState<Candidate[]>([]);

  return (
    <div className="flex max-w-2xl flex-col gap-4 p-6">
      <UnitAddPicker
        initialSearchQuery={initialSearchQuery}
        initialUrlInput={initialUrlInput}
        onSelectCandidate={(candidate) =>
          setAdded((previous) => [...previous, candidate])
        }
      />
      <div className="border-t border-border-whisper pt-2 text-xs leading-dense text-text-secondary">
        Added {added.length} item(s)
      </div>
    </div>
  );
}

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
    return createRouter({
      routeTree: rootRoute.addChildren([bookRoute.addChildren([chapterRoute])]),
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
  title: "App/Unit/UnitAddPicker",
  component: StoryShell,
  decorators: [withStoryRouter],
} satisfies Meta<typeof StoryShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchResults: Story = {
  args: { initialSearchQuery: "demo" },
};

export const UrlCandidates: Story = {
  args: { initialUrlInput: "/book/book-abc/read/chapter-xyz" },
};

export const ParseError: Story = {
  args: { initialUrlInput: "not-a-valid-url" },
};

export const EmptySearch: Story = {
  args: { initialSearchQuery: "missing" },
};

export const RepeatedAddActions: Story = {
  args: { initialSearchQuery: "demo" },
  render: (args) => {
    const [added, setAdded] = useState<Candidate[]>([]);
    useHydrateUnitCache();
    return (
      <div className="flex max-w-2xl flex-col gap-4 p-6">
        <UnitAddPicker
          {...args}
          renderItemAction={(candidate) => (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAdded((previous) => [...previous, candidate])}
            >
              Add again
            </Button>
          )}
        />
        <div className="border-t border-border-whisper pt-2 text-xs leading-dense text-text-secondary">
          Added {added.length} item(s)
        </div>
      </div>
    );
  },
};
