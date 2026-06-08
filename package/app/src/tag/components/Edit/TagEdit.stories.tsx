import { tagApi } from "@rezics/api/tag/tag";
import { unitApi } from "@rezics/api/unit/unit";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { TagEdit } from "./TagEdit";

type TagDetailDTO = {
  id: string;
  name: string;
  type: string | null;
  domains: string[];
};

type Args = {
  mode: "create" | "update";
  debugDomainQuery: string;
  searchResultCount: number;
  simulateError: boolean;
};

function Render({
  mode,
  debugDomainQuery,
  searchResultCount,
  simulateError,
}: Args) {
  const [saved, setSaved] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    (tagApi as any)._origCreate ||= tagApi.create;
    (tagApi as any)._origUpdate ||= tagApi.update;
    (unitApi as any)._origSearch ||= unitApi.search;

    tagApi.create = async (input: any) => {
      if (simulateError) {
        const err = new Error("模拟创建失败 (simulateError=true)");
        setLastError(err.message);
        throw err;
      }
      const fake: TagDetailDTO = {
        id: `tag_${Date.now()}`,
        name: input.name,
        type: input.type ?? null,
        domains: input.domains ?? [],
      };
      return fake as any;
    };
    tagApi.update = async (unitId: string, input: any) => {
      const fake: TagDetailDTO = {
        id: unitId,
        name: `${input.name}_updated`,
        type: input.type ?? null,
        domains: input.domains ?? [],
      };
      return fake as any;
    };
    unitApi.search = async (query: string, _filters: any) => {
      const units = Array.from({ length: searchResultCount }).map((_, i) => ({
        id: `domain_${i}_${query}`,
        title: `Domain ${i} (${query})`,
      }));
      return { units } as any;
    };
    return () => {
      if ((tagApi as any)._origCreate)
        tagApi.create = (tagApi as any)._origCreate;
      if ((tagApi as any)._origUpdate)
        tagApi.update = (tagApi as any)._origUpdate;
      if ((unitApi as any)._origSearch)
        unitApi.search = (unitApi as any)._origSearch;
    };
  }, [searchResultCount, simulateError]);

  const updateTag: any =
    mode === "update"
      ? {
          unitId: "tag_existing_1",
          tagUnitId: "tag_existing_1",
          score: 0,
          voteCount: 0,
        }
      : null;

  return (
    <div className="pt-4 pl-4">
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 420px" }}>
          <TagEdit
            tag={updateTag}
            onSaved={(t) => {
              setSaved(t);
              setLastError(null);
            }}
            className="p-4 border rounded-md space-y-4"
          />
        </div>
        <div style={{ flex: 1, fontSize: 12 }}>
          <h3 style={{ marginTop: 0 }}>TagEdit Story 控制台</h3>
          <div>
            mode: <code>{mode}</code>
          </div>
          <div>
            debugDomainQuery: <code>{debugDomainQuery}</code>
          </div>
          <div>
            searchResultCount: <code>{searchResultCount}</code>
          </div>
          <div>
            simulateError: <code>{String(simulateError)}</code>
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>已保存 (onSaved):</strong>
            <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
              {saved ? JSON.stringify(saved, null, 2) : "尚未保存"}
            </pre>
          </div>
          {lastError && (
            <div style={{ color: "#d22", marginTop: 8 }}>错误: {lastError}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "App/Tag/TagEdit",
  component: TagEdit,
  args: {
    mode: "create",
    debugDomainQuery: "dom",
    searchResultCount: 3,
    simulateError: false,
  },
  argTypes: {
    mode: { control: "radio", options: ["create", "update"] },
    debugDomainQuery: { control: "text" },
    searchResultCount: { control: { type: "range", min: 0, max: 10 } },
    simulateError: { control: "boolean" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Interactive: Story = {
  render: (args) => <Render {...args} />,
};
