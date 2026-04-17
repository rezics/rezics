import { tagApi } from "@rezics/api/tag/tag";
import { unitApi } from "@rezics/api/unit/unit";

/** Local type for tag detail used in test fixtures */
type TagDetailDTO = {
  id: string;
  name: string;
  type: string | null;
  domains: string[];
};
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useFixtureInput } from "react-cosmos/client";
import TagListEdit from "./TagListEdit";

/**
 * Cosmos Fixture: TagListEdit
 * 用例：模拟按对象管理标签（查询/新建/绑定/解绑），避免真实网络请求
 * - objectUnitId: 目标对象 id
 * - seedCount: 初始种子标签数量
 * - simulateError: 模拟 attach/detach/create 的错误
 */
export default function TagListEditFixture() {
  const [objectUnitId] = useFixtureInput<string>("objectUnitId", "book_1");
  const [seedCount] = useFixtureInput<number>("seedCount", 4);
  const [simulateError] = useFixtureInput<boolean>("simulateError", false);

  // 展示用：最近一次动作
  const [lastAction, setLastAction] = useState<string>("初始化");

  // 简单内存 DB：每个对象 id -> tags[]
  const [db, setDb] = useState<Record<string, TagDetailDTO[]>>({});

  // 初始化/重置 DB 的当前对象标签
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

  // --- Mock Layer ---------------------------------------------------------
  useEffect(() => {
    // 保存原方法一次
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
        // 若不存在则添加一个占位（通常来自 create 成功回调）
        if (!list.some((t) => t.id === tagUnitId)) {
          const newTag: TagDetailDTO = {
            id: tagUnitId,
            name: `新建-${tagUnitId.slice(-5)}`,
            type: null,
            domains: [],
          } as TagDetailDTO;
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
        [unitId]: (prev[unitId] || []).filter(
          (t) => t.id !== tagUnitId,
        ),
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
      } as TagDetailDTO;
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
  // -----------------------------------------------------------------------

  const qc = useMemo(() => new QueryClient(), []);

  return (
    <div className="pt-4 pl-4">
      <QueryClientProvider client={qc}>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 460px" }}>
            <TagListEdit
              objectUnitId={objectUnitId}
              className="p-4 border rounded-md"
            />
          </div>
          <div style={{ flex: 1, fontSize: 12 }}>
            <h3 style={{ marginTop: 0 }}>TagListEdit Fixture 控制台</h3>
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
              <pre
                style={{ background: "#f5f5f5", padding: 8, borderRadius: 4 }}
              >
                {JSON.stringify(db[objectUnitId] ?? [], null, 2)}
              </pre>
            </div>
            <p style={{ color: "#666" }}>
              交互指引：
              <br />• 点击“新建标签”打开内嵌编辑器，创建后会自动绑定
              <br />• 在列表中点击“解绑”测试 detach 行为
              <br />• 切换“分组”查看按 domain 的分组展示
            </p>
          </div>
        </div>
      </QueryClientProvider>
    </div>
  );
}
