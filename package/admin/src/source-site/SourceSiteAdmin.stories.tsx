import type { SourceSiteDTO } from "@rezics/contract";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { SourceSiteForm } from "./pages/SourceSitesPage";

const meta = {
  title: "Admin/Source Sites",
  parameters: {
    docs: {
      description: {
        component:
          "SourceSite admin forms keep Entity display identity separate from operational source configuration.",
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const qidian: SourceSiteDTO = {
  entityUnitId: "0198f0ef-0000-7000-8000-000000000001",
  key: "qidian",
  crawlSupport: "supported",
  crawlEnabled: false,
  crawlerAdapterKey: "qidian",
  supportsCrawl: true,
  canScheduleCrawl: false,
  refRules: [
    {
      externalKind: "book",
      externalIdName: "bookId",
      urlTemplate: "https://book.qidian.com/info/{externalId}",
      urlMatchPattern:
        "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
      crawlerActionKey: "qidian.book",
      crawlSupported: true,
    },
  ],
  entity: {
    unitId: "0198f0ef-0000-7000-8000-000000000001",
    kind: "organization",
    verified: true,
    eligibleCreditRoles: [],
    eligibleSubjectRoles: [],
    slug: "qidian",
    translations: [
      { unitId: "source-site-1", language: "zh-hant", title: "起點中文網" },
    ],
  },
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="max-w-[760px] bg-surface-canvas p-6">{children}</div>
    </QueryClientProvider>
  );
}

export const Create: Story = {
  render: () => (
    <Frame>
      <SourceSiteForm />
    </Frame>
  ),
};

export const DisabledCrawlEdit: Story = {
  render: () => (
    <Frame>
      <SourceSiteForm sourceSite={qidian} />
    </Frame>
  ),
};
