import { tagApi } from "@rezics/contract/api/tag/tag";
import { unitApi } from "@rezics/contract/api/unit/unit";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { TagListEdit } from "./TagListEdit";

type TagDetailDTO = {
  id: string;
  name: string;
  type: string | null;
  domains: string[];
};

type Args = {
  objectUnitId: string;
  seedCount: number;
  simulateError: boolean;
};

function Render({ objectUnitId, seedCount, simulateError }: Args) {
  const [lastAction, setLastAction] = useState<string>("初始化");
  const [db, setDb] = useState<Record<string, TagDetailDTO[]>>({});

  useEffect(() => {
    setDb((prev) => ({
      ...prev,
      [objectUnitId]: Array.from({ length: seedCount }).map((_, i) => ({
        id: `${objectUnitId}_tag_${i + 1}`,
        name: `标签 ${i + 1}`,
        type: i % 2 === 0 ? "TOPIC" : "GENRE",
        domains: i % 3 === 0 ? [`domain_${i % 2}`] : [],
      })),
    }));
  }, [objectUnitId, seedCount]);

  useEffect(() => {
    (tagApi as any)._origList ||= tagApi.list;
    (tagApi as any)._origAttach ||= tagApi.attach;
    (tagApi as any)._origDetach ||= tagApi.detach;
    (tagApi as any)._origCreate ||= tagApi.create;
    (unitApi as any)._origSearch ||= unitApi.search;

    tagApi.list = async (filters?: any) => {
      const objId = filters?.objectId;
      const tags = (objId && db[objId]) || [];
      return { tags, total: tags.length } as any;
    };
    tagApi.attach = async (input: { tagUnitId: string; unitId: string }) => {
      if (simulateError) {
        const err = new Error("模拟 attach 失败");
        setLastAction(err.message);
        throw err;
      }
      const { tagUnitId, unitId } = input;
      setDb((prev) => {
        const list = prev[unitId] || [];
        if (!list.some((t) => t.id === tagUnitId)) {
          const newTag: TagDetailDTO = {
            id: tagUnitId,
            name: `新建-${tagUnitId.slice(-5)}`,
            type: null,
            domains: [],
          };
          return { ...prev, [unitId]: [...list, newTag] };
        }
        return prev;
      });
      setLastAction(`attach ${tagUnitId} -> ${unitId}`);
      return { message: "ok" } as any;
    };
    tagApi.detach = async (input: { tagUnitId: string; unitId: string }) => {
      if (simulateError) {
        const err = new Error("模拟 detach 失败");
        setLastAction(err.message);
        throw err;
      }
      const { tagUnitId, unitId } = input;
      setDb((prev) => ({
        ...prev,
        [unitId]: (prev[unitId] || []).filter((t) => t.id !== tagUnitId),
      }));
      setLastAction(`detach ${tagUnitId} -/-> ${unitId}`);
      return { message: "ok" } as any;
    };
    tagApi.create = async (input: any) => {
      if (simulateError) {
        const err = new Error("模拟 create 失败");
        setLastAction(err.message);
        throw err;
      }
      const fake: TagDetailDTO = {
        id: `tag_${Date.now()}`,
        name: input?.name ?? "新建标签",
        type: input?.type ?? null,
        domains: input?.domains ?? [],
      };
      setLastAction(`create ${fake.name}`);
      return fake as any;
    };
    unitApi.search = async (query: string, _filters: any) => {
      const units = Array.from({ length: 3 }).map((_, i) => ({
        id: `domain_${i}_${query}`,
        title: `Domain ${i} (${query})`,
      }));
      return { units } as any;
    };

    return () => {
      if ((tagApi as any)._origList) tagApi.list = (tagApi as any)._origList;
      if ((tagApi as any)._origAttach)
        tagApi.attach = (tagApi as any)._origAttach;
      if ((tagApi as any)._origDetach)
        tagApi.detach = (tagApi as any)._origDetach;
      if ((tagApi as any)._origCreate)
        tagApi.create = (tagApi as any)._origCreate;
      if ((unitApi as any)._origSearch)
        unitApi.search = (unitApi as any)._origSearch;
    };
  }, [db, simulateError]);

  return (
    <div className="pt-4 pl-4">
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 460px" }}>
          <TagListEdit
            objectUnitId={objectUnitId}
            className="p-4 border rounded-md"
          />
        </div>
        <div style={{ flex: 1, fontSize: 12 }}>
          <h3 style={{ marginTop: 0 }}>TagListEdit Story 控制台</h3>
          <div>
            objectUnitId: <code>{objectUnitId}</code>
          </div>
          <div>
            seedCount: <code>{seedCount}</code>
          </div>
          <div>
            simulateError: <code>{String(simulateError)}</code>
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>最近动作:</strong> {lastAction}
          </div>
          <div style={{ marginTop: 12 }}>
            <strong>DB[{objectUnitId}]</strong>
            <pre style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}>
              {JSON.stringify(db[objectUnitId] ?? [], null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "App/Tag/TagListEdit",
  component: TagListEdit,
  args: {
    objectUnitId: "book_1",
    seedCount: 4,
    simulateError: false,
  },
  argTypes: {
    objectUnitId: { control: "text" },
    seedCount: { control: { type: "range", min: 0, max: 10 } },
    simulateError: { control: "boolean" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

export const Interactive: Story = {
  render: (args) => <Render {...args} />,
};
