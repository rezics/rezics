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
import { unitKeys } from "@rezics/api/unit/unit.keys";
import type {
  ExcerptSource,
  UnitDTO,
  UnitListResponse,
  UnitResponse,
} from "@rezics/contract";
import { ExcerptSourcePicker } from "./ExcerptSourcePicker";

// MOCK: fixtures used to hydrate the React Query cache so the stories render
// resolved unit titles instead of identifiers.
const fixtureBook: UnitDTO = {
  id: "book-abc",
  type: "book",
  translations: [
    { unitId: "book-abc", language: "en", title: "The Demo Book" },
  ],
  defaultLanguage: "en",
};

const fixtureChapter: UnitDTO = {
  id: "chapter-xyz",
  type: "chapter",
  workUnitId: "book-abc",
  translations: [
    { unitId: "chapter-xyz", language: "en", title: "Chapter 1: Beginnings" },
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
];

function useHydrateCache() {
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

interface WrapperProps {
  initial?: ExcerptSource;
  disabled?: boolean;
  error?: string;
  targetUnitId?: string;
}

function Wrapper(args: WrapperProps) {
  useHydrateCache();
  const [value, setValue] = useState<ExcerptSource | undefined>(args.initial);
  return (
    <ExcerptSourcePicker
      value={value}
      onChange={setValue}
      disabled={args.disabled}
      error={args.error}
      targetUnitId={args.targetUnitId}
      language="en"
    />
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
  title: "Domain/Excerpt/ExcerptSourcePicker",
  component: Wrapper,
  decorators: [withStoryRouter],
} satisfies Meta<typeof Wrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithError: Story = {
  args: { error: "Source URL is required" },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    initial: {
      mode: "url",
      url: "https://example.com/articles/quiet-library",
      title: "On quiet libraries",
    },
  },
};

export const TwoIdUrlPicksChapter: Story = {
  args: {
    targetUnitId: "book-abc",
  },
};
