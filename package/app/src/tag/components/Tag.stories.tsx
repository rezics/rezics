import { faker } from "@faker-js/faker";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import TagCard, { TagDetailCard } from "./TagCards";
import TagList from "./TagList";
import TagWrapper from "./TagWrapper";

type TagDetailDTO = {
  id: string;
  name: string;
  type: string | null;
  domains: string[];
  content?: string;
  i18n?: any;
};

const API_BASE =
  (import.meta as any)?.env?.VITE_API_URL || "http://localhost:4000";

const store = {
  tags: [] as TagDetailDTO[],
};

let workerStarted = false;
const ensureWorker = async () => {
  if (workerStarted) return;
  const worker = setupWorker(
    http.get(`${API_BASE}/tag/list`, ({ request }) => {
      const url = new URL(request.url);
      const domainId = url.searchParams.get("domainId") || undefined;
      let tags = store.tags;
      if (domainId) {
        tags = tags.filter((t) => (t.domains || []).includes(domainId));
      }
      return HttpResponse.json({ tags, total: tags.length });
    }),
    http.get(`${API_BASE}/tag/:unitId`, ({ params }) => {
      const tag = store.tags.find((t) => t.id === String(params.unitId));
      if (!tag)
        return HttpResponse.json({ message: "Not Found" }, { status: 404 });
      return HttpResponse.json(tag);
    }),
    http.get(`${API_BASE}/unit/:unitId`, ({ params }) => {
      const id = String(params.unitId);
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

type Args = {
  includeNoDomain: boolean;
  limit: number;
  cardIdx: number;
  cardSelected: boolean;
  detailIdx: number;
  autoSelectFirst: boolean;
};

function Render({
  includeNoDomain,
  limit,
  cardIdx,
  cardSelected,
  detailIdx,
  autoSelectFirst,
}: Args) {
  const [seed] = useState(() => faker.number.int());
  faker.seed(seed);

  const baseTags = useMemo(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const demoTags = useMemo(() => {
    const list = baseTags.filter(
      (t) => includeNoDomain || (t.domains && t.domains.length > 0),
    );
    return list.slice(0, limit);
  }, [baseTags, includeNoDomain, limit]);

  useEffect(() => {
    store.tags = demoTags;
  }, [demoTags]);

  useEffect(() => {
    ensureWorker();
  }, []);

  const cardTag =
    demoTags[Math.min(cardIdx, Math.max(0, demoTags.length - 1))] ?? makeTag();

  const detailTag =
    demoTags[Math.min(detailIdx, Math.max(0, demoTags.length - 1))] ??
    makeTag();

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
      <h2 className="text-xl font-bold">Tag Components – Interactive Story</h2>

      <Section title="TagCard">
        <div className="max-w-xl">
          <TagCard
            tag={cardTag as any}
            selected={cardSelected}
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
        <TagList tags={demoTags as any} autoSelectFirst={autoSelectFirst} />
      </Section>

      <Section title="TagWrapper – Flat 模式（通过 React Query + MSW 拉取）">
        <TagWrapper
          mode="flat"
          filters={{ q: "", type: null, domainId: null, limit: 20 } as any}
        />
      </Section>

      <Section title="TagWrapper – Grouped 模式（按 domain 分组）">
        <div className="mb-2 text-xs text-gray-600">
          可用 domainIds:{" "}
          {knownDomains.map((d) => d.slice(0, 6)).join(", ") || "（无）"}
        </div>
        <TagWrapper mode="grouped" domainIds={undefined} />
      </Section>
    </div>
  );
}

const meta = {
  title: "App/Tag/Tag",
  args: {
    includeNoDomain: true,
    limit: 20,
    cardIdx: 0,
    cardSelected: false,
    detailIdx: 1,
    autoSelectFirst: false,
  },
  argTypes: {
    includeNoDomain: { control: "boolean" },
    limit: { control: { type: "range", min: 1, max: 20 } },
    cardIdx: { control: { type: "range", min: 0, max: 5 } },
    cardSelected: { control: "boolean" },
    detailIdx: { control: { type: "range", min: 0, max: 5 } },
    autoSelectFirst: { control: "boolean" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Interactive: Story = {
  render: (args) => <Render {...args} />,
};
