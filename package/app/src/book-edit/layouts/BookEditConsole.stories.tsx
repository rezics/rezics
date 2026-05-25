import {
  book_edit_sidebar_history,
  edit_console_chapter_context_back_to_chapters,
  edit_console_chapter_context_label,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Separator } from "@rezics/ui/shadcn";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { BookOpenText } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { NavigationList } from "@/core/components/navigation/NavigationList";
import type { NavigationItem } from "@/core/components/navigation/navigation";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { historyBookId } from "@/stories/fixtures/history";
import { createBookEditConsoleConfig } from "./bookEditConsoleConfig";

const meta = {
  title: "Domain/Book/Edit/Console Layout",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const i18nMessages = {
  book_edit_sidebar_history,
  edit_console_chapter_context_back_to_chapters,
  edit_console_chapter_context_label,
};

function withRouterAt(initialPath: string): Decorator {
  return (Story) => {
    const RouterHost = () => {
      const router = useMemo(() => {
        const rootRoute = createRootRoute({
          component: () => <Story />,
        });
        return createRouter({
          routeTree: rootRoute,
          history: createMemoryHistory({ initialEntries: [initialPath] }),
        });
      }, []);
      return <RouterProvider router={router as never} />;
    };
    return <RouterHost />;
  };
}

function bookConsoleNavigation(): NavigationItem[] {
  const config = createBookEditConsoleConfig(historyBookId);
  return [
    config.returnItem,
    ...config.primaryItems,
    ...(config.operationalItems ?? []),
  ].map((item) => ({
    kind: "item",
    title: item.label,
    segment: item.href,
    icon: item.icon,
    activeMatch: item.activeMatch,
    isActive: item.isActive,
  }));
}

function SidebarFixture({
  context,
  pathname,
}: {
  context?: React.ReactNode;
  pathname: string;
}) {
  return (
    <aside className="flex h-[32rem] w-72 flex-col rounded-md bg-surface-base p-3">
      <NavigationList
        NAVIGATION={bookConsoleNavigation()}
        isMobile={false}
        pathname={pathname}
        openItems={{}}
        handleItemClick={() => undefined}
      />
      {context ? (
        <div className="mt-2 min-h-0 flex-1">
          <Separator className="mb-2" />
          <div className="min-h-0 overflow-y-auto">{context}</div>
        </div>
      ) : null}
    </aside>
  );
}

function ChapterContextPreview() {
  const m = useMessage(i18nMessages);

  return (
    <div className="grid gap-2 rounded-md bg-surface-subtle p-3">
      <div className="flex items-center gap-2 text-xs font-medium leading-dense text-text-secondary">
        <BookOpenText className="h-4 w-4" aria-hidden="true" />
        {m.edit_console_chapter_context_label()}
      </div>
      <p className="text-sm font-medium leading-ui text-text-primary">
        Chapter 12: A quiet archive
      </p>
      <p className="text-xs leading-dense text-text-secondary">
        {m.edit_console_chapter_context_back_to_chapters()}
      </p>
    </div>
  );
}

function SharedLayoutShellPreview() {
  const m = useMessage(i18nMessages);

  return (
    <EditConsoleLayout {...createBookEditConsoleConfig(historyBookId)}>
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-lg font-medium leading-ui text-text-primary">
          {m.book_edit_sidebar_history()}
        </h2>
      </section>
    </EditConsoleLayout>
  );
}

export const SharedLayoutShell: Story = {
  decorators: [withRouterAt(`/book/${historyBookId}/edit/history`)],
  render: () => <SharedLayoutShellPreview />,
};

export const ActiveHistoryNavigation: Story = {
  render: () => (
    <div className="p-8">
      <SidebarFixture
        pathname={`/book/${historyBookId}/edit/history/compare/3`}
      />
    </div>
  ),
};

export const ChapterContextBelowDivider: Story = {
  render: () => (
    <div className="p-8">
      <SidebarFixture
        pathname={`/book/${historyBookId}/edit/chapter-1`}
        context={<ChapterContextPreview />}
      />
    </div>
  ),
};

export const EmptyContextNoReservedArea: Story = {
  render: () => (
    <div className="p-8">
      <SidebarFixture pathname={`/book/${historyBookId}/edit/tag`} />
    </div>
  ),
};
