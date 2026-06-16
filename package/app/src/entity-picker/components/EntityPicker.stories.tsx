import type { EntityDTO } from "@rezics/contract";
import { Button } from "@rezics/ui/shadcn";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { withRouter } from "@/stories/decorators/withRouter";
import { EntityPicker } from "./EntityPicker";

// MOCK: deterministic fixture entities used to seed the QueryClient cache so
// useEntitySearch() returns results without hitting the network.
// MOCK：用于填充 QueryClient 缓存的确定性夹具实体，使 useEntitySearch()
// 无需访问网络即可返回结果。
const fixtureEntities: EntityDTO[] = [
  {
    unitId: "00000000-0000-4000-8000-000000000001",
    kind: "person",
    verified: true,
    eligibleCreditRoles: ["author", "writer"],
    eligibleSubjectRoles: ["about"],
    slug: "liu-cixin",
    ownerUnitId: null,
    translations: [
      { language: "en", title: "Liu Cixin" },
      { language: "zh", title: "刘慈欣" },
    ],
  } as EntityDTO,
  {
    unitId: "00000000-0000-4000-8000-000000000002",
    kind: "person",
    verified: false,
    eligibleCreditRoles: ["author"],
    eligibleSubjectRoles: ["about"],
    slug: null,
    ownerUnitId: null,
    translations: [{ language: "en", title: "Liu Yuan" }],
  } as EntityDTO,
  {
    unitId: "00000000-0000-4000-8000-000000000003",
    kind: "studio",
    verified: false,
    eligibleCreditRoles: ["studio", "developer"],
    eligibleSubjectRoles: [],
    slug: null,
    ownerUnitId: null,
    translations: [{ language: "en", title: "Liu Animation Studio" }],
  } as EntityDTO,
];

// MOCK: a hosted QueryClient that returns the fixture entities for any
// `useEntitySearch` call regardless of the query payload.
// MOCK：一个托管的 QueryClient，无论查询载荷如何，都为任意
// `useEntitySearch` 调用返回夹具实体。
const withMockedSearch: Decorator = (Story) => {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            queryFn: async () => ({
              entities: fixtureEntities,
              total: fixtureEntities.length,
            }),
          },
        },
      }),
  );
  useEffect(() => () => qc.clear(), [qc]);
  return (
    <QueryClientProvider client={qc}>
      <Story />
    </QueryClientProvider>
  );
};

function PickerHarness({ kindHint }: { kindHint?: string }) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 p-6">
      <Button onClick={() => setOpen(true)}>Open EntityPicker</Button>
      {selected ? (
        <p className="text-sm text-text-secondary">Selected: {selected}</p>
      ) : null}
      <EntityPicker
        open={open}
        onOpenChange={setOpen}
        onSelect={(unitId) => setSelected(unitId)}
        kindHint={kindHint}
      />
    </div>
  );
}

const meta = {
  title: "Domain/Entity/EntityPicker",
  component: PickerHarness,
  decorators: [withMockedSearch, withRouter],
} satisfies Meta<typeof PickerHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPersonHint: Story = {
  args: { kindHint: "person" },
};

export const WithStudioHint: Story = {
  args: { kindHint: "studio" },
};
