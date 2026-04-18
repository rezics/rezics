import { faker } from "@faker-js/faker";

/** Local type for tag detail used in test fixtures */
type TagDetailDTO = {
  id: string;
  name: string;
  type: string | null;
  domains: string[];
  content?: string;
  i18n?: any;
};

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// MSW v2
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useFixtureInput } from "react-cosmos/client";
import TagCard, { TagDetailCard } from "./TagCards";
import TagList from "./TagList";
import TagWrapper from "./TagWrapper";

// Infer the base URL used by apiFetch (see src/api/react-query/http.ts)
const API_BASE =
  (import.meta as any)?.env?.VITE_API_URL || "http://localhost:4000";

// Keep a module-scoped ref-like store for handlers to read latest data
const store = {
  tags: [] as TagDetailDTO[],
};

let workerStarted = false;
const ensureWorker = async () => {
  if (workerStarted) return;
  const worker = setupWorker(
    // GET /tag/list
    http.get(`${API_BASE}/tag/list`, ({ request }) => {
      const url = new URL(request.url);
      const domainId = url.searchParams.get("domainId") || undefined;
      // Basic filter logic for demo
      let tags = store.tags;
      if (domainId) {
        tags = tags.filter((t) => (t.domains || []).includes(domainId));
      }
      return HttpResponse.json({ tags, total: tags.length });
    }),

    // GET /tag/:unitId (detail)
    http.get(`${API_BASE}/tag/:unitId`, ({ params }) => {
      const tag = store.tags.find((t) => t.id === String(params.unitId));
      if (!tag)
        return HttpResponse.json({ message: "Not Found" }, { status: 404 });
      return HttpResponse.json(tag);
    }),

    // GET /unit/:unitId (used for domain title in grouped mode)
    http.get(`${API_BASE}/unit/:unitId`, ({ params }) => {
      const id = String(params.unitId);
      // Find a tag that references this domain id and derive a friendly title
      const title = `Domain ${id.slice(0, 6).toUpperCase()}`;
      return HttpResponse.json({
        id,
        userId: "demo-user",
        type: "DOMAIN",
        title,
        content: `This is a mock Unit for domain ${id}.`,
      });
    }),
  );
  await worker.start({ onUnhandledRequest: "bypass" });
  workerStarted = true;
};

// Utilities to build demo data
function makeTag(overrides?: Partial<TagDetailDTO>): TagDetailDTO {
  const id = overrides?.id ?? faker.string.uuid();
  return {
    id,
    name: overrides?.name ?? faker.hacker.noun(),
    type:
      overrides?.type ??
      faker.helpers.arrayElement(["GENRE", "TOPIC", "THEME", null]),
    content: overrides?.content ?? faker.lorem.paragraphs({ min: 1, max: 2 }),
    domains:
      overrides?.domains ??
      faker.helpers.arrayElements(
        [faker.string.uuid(), faker.string.uuid(), faker.string.uuid()],
        { min: 0, max: 2 },
      ),
    i18n: overrides?.i18n ?? null,
  };
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mb-8">
    <h3 className="text-lg font-semibold mb-3">{title}</h3>
    <div className="border rounded-md p-3">{children}</div>
  </section>
);

const QueryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const Fixture: React.FC = () => {
  // Generate a stable demo dataset on first mount
  const [seed] = useState(() => faker.number.int());
  faker.seed(seed);

  const baseTags = useMemo(() => {
    // Create a couple of known domains to demo grouping & filtering
    const domainA = faker.string.uuid();
    const domainB = faker.string.uuid();
    const mk = (p?: Partial<TagDetailDTO>) => makeTag(p);
    return [
      mk({ name: "Fantasy", type: "GENRE", domains: [domainA] }),
      mk({ name: "Science", type: "TOPIC", domains: [domainB] }),
      mk({ name: "Philosophy", type: "THEME", domains: [domainA, domainB] }),
      mk({ name: "NoDomainTag", type: null, domains: [] }),
      mk({ name: "Mystery", type: "GENRE", domains: [domainA] }),
      mk({ name: "Space", type: "TOPIC", domains: [domainB] }),
    ];
  }, []);

  // Shared controls for the demo data
  const [dataCtl] = useFixtureInput<{
    includeNoDomain: boolean;
    limit: number;
  }>("Data Controls", {
    includeNoDomain: true,
    limit: 20,
  });

  const demoTags = useMemo(() => {
    const list = baseTags.filter(
      (t) => dataCtl.includeNoDomain || (t.domains && t.domains.length > 0),
    );
    return list.slice(0, dataCtl.limit);
  }, [baseTags, dataCtl.includeNoDomain, dataCtl.limit]);

  // Keep store in sync for MSW
  useEffect(() => {
    store.tags = demoTags;
  }, [demoTags]);

  // Start MSW once
  useEffect(() => {
    ensureWorker();
  }, []);

  // Controls for sub-components
  const [cardCtl] = useFixtureInput<{ idx: number; selected: boolean }>(
    "TagCard Props",
    {
      idx: 0,
      selected: false,
    },
  );

  const cardTag =
    demoTags[Math.min(cardCtl.idx, Math.max(0, demoTags.length - 1))] ??
    makeTag();

  const [detailCtl] = useFixtureInput<{ idx: number }>("TagDetailCard Props", {
    idx: 1,
  });

  const detailTag =
    demoTags[Math.min(detailCtl.idx, Math.max(0, demoTags.length - 1))] ??
    makeTag();

  const [listCtl] = useFixtureInput<{ autoSelectFirst: boolean }>(
    "TagList Props",
    {
      autoSelectFirst: false,
    },
  );

  // TagWrapper controls — test both modes
  const [wrapperFlatCtl] = useFixtureInput<{
    filters:
      | {
          q?: string;
          type?: string | null;
          domainId?: string | null;
          limit?: number | null;
        }
      | undefined;
  }>("TagWrapper Flat Controls", {
    filters: { q: "", type: null, domainId: null, limit: 20 },
  });

  const [wrapperGroupedCtl] = useFixtureInput<{
    domainIds: string[] | undefined;
  }>("TagWrapper Grouped Controls", {
    domainIds: undefined,
  });

  // Provide a suggestion of domains visible in dataset
  const knownDomains = useMemo(() => {
    const set = new Set<string>();
    demoTags.forEach((t) => {
      (t.domains || []).forEach((d: string) => {
        set.add(d);
      });
    });
    return Array.from(set);
  }, [demoTags]);

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-xl font-bold">
        Tag Components – Interactive Fixture
      </h2>

      <Section title="TagCard">
        <div className="max-w-xl">
          <TagCard
            tag={cardTag as any}
            selected={cardCtl.selected}
            onClick={() => {}}
          />
          <div className="text-xs text-gray-500 mt-2">
            idx 选择范围 0 ~ {demoTags.length - 1}
          </div>
        </div>
      </Section>

      <Section title="TagDetailCard">
        <div className="max-w-2xl">
          <TagDetailCard tag={detailTag as any} />
        </div>
      </Section>

      <Section title="TagList">
        <TagList
          tags={demoTags as any}
          autoSelectFirst={listCtl.autoSelectFirst}
        />
        <div className="text-xs text-gray-500 mt-2">
          点击标签切换详情；按住 Ctrl 点击在新窗口打开。
        </div>
      </Section>

      <Section title="TagWrapper – Flat 模式（通过 React Query + MSW 拉取）">
        <QueryProvider>
          <TagWrapper mode="flat" filters={wrapperFlatCtl.filters as any} />
        </QueryProvider>
      </Section>

      <Section title="TagWrapper – Grouped 模式（按 domain 分组）">
        <div className="mb-2 text-xs text-gray-600">
          可用 domainIds:{" "}
          {knownDomains.map((d) => d.slice(0, 6)).join(", ") || "（无）"}
        </div>
        <QueryProvider>
          <TagWrapper mode="grouped" domainIds={wrapperGroupedCtl.domainIds} />
        </QueryProvider>
      </Section>
    </div>
  );
};

Fixture.displayName = "TagFixture";

export default Fixture;
