import { useAlertStore } from "@app/states/windowAlertStore";
import { echoKvApi, echoKvKeyListQuery } from "@rezics/api/echokv/echokv";
import { RezicsJsonEditor } from "@rezics/ui/editor";
import { Button, Input, Label, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Search as SearchIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Page } from "@/core/layouts/Page";

export const EchokvEditPage: React.FC = () => {
  const { show: showAlert } = useAlertStore();

  const [currentKey, setCurrentKey] = useState("key_name");
  const [searchKey, setSearchKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [_saving, setSaving] = useState(false);
  const [editorValue, setEditorValue] = useState("{}");

  const { data: keyList, isLoading: keyListLoading } = useQuery(
    echoKvKeyListQuery(searchKey),
  );

  const handleLoad = async () => {
    if (!currentKey.trim()) return showAlert("请输入 key");

    setLoading(true);
    try {
      const res = await echoKvApi.get(currentKey.trim());
      const raw = res?.value;

      let parsed: { value: unknown };
      if (typeof raw === "string") {
        try {
          parsed = { value: JSON.parse(raw) };
        } catch {
          parsed = { value: raw };
        }
      } else {
        parsed = { value: raw ?? {} };
      }

      setEditorValue(JSON.stringify(parsed, null, 2));
      showAlert("加载成功");
    } catch (err) {
      showAlert(`加载失败：${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setEditorValue("{}");
  };

  const handleSave = async () => {
    if (!currentKey.trim()) return showAlert("请输入 key");

    setSaving(true);
    try {
      const dataObject = JSON.parse(editorValue);
      const value = dataObject.value;

      const result = await echoKvApi.set(currentKey.trim(), value);

      showAlert(`已保存: ${JSON.stringify(result)}`);
    } catch (err) {
      showAlert(`当前 JSON 非法：${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="EchoKV JSON 编辑器">
      <div className="mt-2 rounded-lg p-4 bg-surface-elevated">
        <h2 className="text-base font-semibold mb-2">Key 列表</h2>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="echokv-search">搜索 Key</Label>
            <div className="relative">
              <SearchIcon className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary" />
              <Input
                id="echokv-search"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="max-h-[260px] overflow-auto rounded-md border border-border-whisper">
            {keyListLoading && (
              <div className="p-3">
                <p className="text-sm text-text-secondary">加载中…</p>
              </div>
            )}
            {!keyListLoading &&
              (!keyList?.keys || keyList.keys.length === 0) && (
                <div className="p-3">
                  <p className="text-sm text-text-secondary">暂无数据</p>
                </div>
              )}
            {!keyListLoading && keyList?.keys && keyList.keys.length > 0 && (
              <ul className="list-none">
                {keyList.keys.map((key) => (
                  <li key={key}>
                    <button
                      type="button"
                      title={key}
                      onClick={() => setCurrentKey(key)}
                      className={clsx(
                        "w-full text-left text-sm px-3 py-1.5 hover:bg-surface-subtle whitespace-nowrap overflow-hidden text-ellipsis",
                        currentKey === key &&
                          "bg-primary-container font-semibold",
                      )}
                    >
                      {key}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg overflow-hidden bg-surface-elevated">
        <div className="px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-1 min-w-[260px]">
              <Label htmlFor="echokv-key">Key</Label>
              <Input
                id="echokv-key"
                value={currentKey}
                onChange={(e) => setCurrentKey(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-row gap-2 flex-1 justify-end items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoad}
                disabled={loading}
              >
                {loading ? "加载中…" : "加载"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={loading}
              >
                清空
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="p-4 min-h-[500px]">
          <RezicsJsonEditor
            value={editorValue}
            onChange={setEditorValue}
            onSubmit={handleSave}
          />
        </div>
      </div>
    </Page>
  );
};

export default EchokvEditPage;
