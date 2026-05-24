import {
  useClearRealmExtraValueMutation,
  useSetRealmExtraValueMutation,
} from "@rezics/api/realm/realm-extra.mutations";
import { tagQueries } from "@rezics/api/tag/tag";
import { unitQueries } from "@rezics/api/unit/unit";
import type {
  RealmBannerExtra,
  RealmExtra,
  TagTreeNode,
  UnitDTO,
} from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Button, Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getTranslation } from "@/shared/utils/translation-helpers";

export interface RealmExtraManageSectionProps {
  realmId: string;
  extra?: RealmExtra | null;
}

type TagSearchResult = {
  unitId?: string;
  tagUnitId?: string;
  label?: string;
  slug?: string;
};

function nodeLabel(node: TagTreeNode) {
  return node.label?.trim() || node.tagId?.slice(0, 8) || m.common_untitled();
}

function nodeKey(node: TagTreeNode) {
  return node.tagId ?? node.label ?? "untitled-node";
}

function unitLabel(unit: UnitDTO) {
  const tr = getTranslation(
    unit.translations,
    undefined,
    unit.defaultLanguage ?? undefined,
  );
  return tr?.title ?? unit.slug ?? unit.id;
}

export const RealmExtraManageSection: React.FC<
  RealmExtraManageSectionProps
> = ({ realmId, extra }) => {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold leading-ui text-text-primary">
          {m.realm_forum_settings()}
        </h2>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {m.realm_forum_settings_description()}
        </p>
      </div>
      <TagTreeEditor
        realmId={realmId}
        initialValue={extra?.tagTree as TagTreeNode[] | undefined}
      />
      <SlotPicker realmId={realmId} slotKey="rule" value={extra?.rule} />
      <SlotPicker realmId={realmId} slotKey="about" value={extra?.about} />
      <BannerPicker realmId={realmId} value={extra?.banner ?? null} />
    </section>
  );
};

function TagTreeEditor({
  realmId,
  initialValue,
}: {
  realmId: string;
  initialValue?: TagTreeNode[];
}) {
  const [nodes, setNodes] = useState<TagTreeNode[]>(initialValue ?? []);
  const [headerLabel, setHeaderLabel] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setValue = useSetRealmExtraValueMutation();
  const searchTerm = search.trim();
  const { data: searchData } = useQuery(tagQueries.search(searchTerm));
  const results = useMemo(() => {
    return ((searchData?.tags ?? []) as TagSearchResult[]).flatMap((tag) => {
      const tagId = tag.unitId ?? tag.tagUnitId;
      if (!tagId || nodes.some((node) => node.tagId === tagId)) return [];
      return [{ tagId, label: tag.label ?? tag.slug ?? tagId.slice(0, 8) }];
    });
  }, [nodes, searchData?.tags]);

  useEffect(() => {
    setNodes(initialValue ?? []);
  }, [initialValue]);

  const updateNode = (index: number, next: TagTreeNode) => {
    setNodes((current) =>
      current.map((node, nodeIndex) => (nodeIndex === index ? next : node)),
    );
  };

  const moveNode = (index: number, delta: -1 | 1) => {
    setNodes((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const save = async () => {
    setError(null);
    try {
      await setValue.mutateAsync({
        realmId,
        key: "tagTree",
        value: nodes,
      });
      toast.success(m.realm_tag_tree_saved());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <div>
        <h3 className="text-sm font-medium leading-ui text-text-primary">
          {m.realm_tag_tree()}
        </h3>
        <p className="mt-1 text-sm leading-body text-text-secondary">
          {m.realm_tag_tree_description()}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {nodes.map((node, index) => (
          <div
            key={nodeKey(node)}
            className="flex flex-wrap items-center gap-2"
          >
            <Input
              value={nodeLabel(node)}
              onChange={(event) =>
                updateNode(index, { ...node, label: event.target.value })
              }
              className="min-w-48 flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant={node.disabled ? "secondary" : "outline"}
              onClick={() =>
                updateNode(index, { ...node, disabled: !node.disabled })
              }
            >
              {node.disabled ? m.common_disabled() : m.common_enabled()}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => moveNode(index, -1)}
            >
              {m.common_up()}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => moveNode(index, 1)}
            >
              {m.common_down()}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() =>
                setNodes((current) => current.filter((_, i) => i !== index))
              }
            >
              {m.common_delete()}
            </Button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex gap-2">
          <Input
            value={headerLabel}
            onChange={(event) => setHeaderLabel(event.target.value)}
            placeholder={m.realm_header_label_placeholder()}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!headerLabel.trim()) return;
              setNodes((current) => [
                ...current,
                { disabled: true, label: headerLabel.trim() },
              ]);
              setHeaderLabel("");
            }}
          >
            {m.realm_add_header()}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={m.tag_search_placeholder()}
          />
          {searchTerm && results.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {results.map((tag) => (
                <Button
                  key={tag.tagId}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setNodes((current) => [
                      ...current,
                      { tagId: tag.tagId, label: tag.label },
                    ])
                  }
                >
                  {tag.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button onClick={save} disabled={setValue.isPending}>
          {m.realm_save_tag_tree()}
        </Button>
      </div>
    </div>
  );
}

function SlotPicker({
  realmId,
  slotKey,
  value,
}: {
  realmId: string;
  slotKey: "rule" | "about";
  value?: string | null;
}) {
  const [selected, setSelected] = useState(value ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const searchTerm = search.trim();
  const { data } = useQuery(
    unitQueries.search(searchTerm, { type: "POST", limit: 8 }),
  );

  useEffect(() => {
    setSelected(value ?? "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (selected) {
        await setValue.mutateAsync({ realmId, key: slotKey, value: selected });
      } else {
        await clearValue.mutateAsync({ realmId, key: slotKey });
      }
      toast.success(
        slotKey === "rule" ? m.realm_rule_saved() : m.realm_about_saved(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <Label>
        {slotKey === "rule" ? m.realm_rule_post() : m.realm_about_post()}
      </Label>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={m.post_search_placeholder()}
      />
      {searchTerm && data?.units?.length ? (
        <div className="flex flex-col gap-2">
          {data.units.map((unit) => (
            <Button
              key={unit.id}
              type="button"
              size="sm"
              variant={selected === unit.id ? "default" : "secondary"}
              className="justify-start"
              onClick={() => setSelected(unit.id)}
            >
              {unitLabel(unit)}
            </Button>
          ))}
        </div>
      ) : null}
      {selected && (
        <p className="text-sm leading-ui text-text-secondary">
          {m.common_selected_id({ id: selected })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button type="button" variant="ghost" onClick={() => setSelected("")}>
          {m.common_clear()}
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={setValue.isPending || clearValue.isPending}
        >
          {m.common_save()}
        </Button>
      </div>
    </div>
  );
}

function BannerPicker({
  realmId,
  value,
}: {
  realmId: string;
  value?: RealmBannerExtra | null;
}) {
  const [url, setUrl] = useState(value?.kind === "url" ? value.url : "");
  const [postId, setPostId] = useState(
    value?.kind === "post" ? value.unitId : "",
  );
  const setValue = useSetRealmExtraValueMutation();
  const clearValue = useClearRealmExtraValueMutation();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const searchTerm = search.trim();
  const { data } = useQuery(
    unitQueries.search(searchTerm, { type: "POST", limit: 8 }),
  );

  useEffect(() => {
    setUrl(value?.kind === "url" ? value.url : "");
    setPostId(value?.kind === "post" ? value.unitId : "");
  }, [value]);

  const save = async () => {
    setError(null);
    try {
      if (url.trim()) {
        await setValue.mutateAsync({
          realmId,
          key: "banner",
          value: { kind: "url", url: url.trim() },
        });
      } else if (postId) {
        await setValue.mutateAsync({
          realmId,
          key: "banner",
          value: { kind: "post", unitId: postId },
        });
      } else {
        await clearValue.mutateAsync({ realmId, key: "banner" });
      }
      toast.success(m.realm_banner_saved());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-4">
      <Label>{m.realm_banner()}</Label>
      <Input
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          if (event.target.value.trim()) setPostId("");
        }}
        placeholder={m.realm_direct_image_url_placeholder()}
      />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={m.post_search_placeholder()}
      />
      {searchTerm && data?.units?.length ? (
        <div className="flex flex-col gap-2">
          {data.units.map((unit) => (
            <Button
              key={unit.id}
              type="button"
              size="sm"
              variant={postId === unit.id ? "default" : "secondary"}
              className="justify-start"
              onClick={() => {
                setPostId(unit.id);
                setUrl("");
              }}
            >
              {unitLabel(unit)}
            </Button>
          ))}
        </div>
      ) : null}
      {postId && (
        <p className="text-sm leading-ui text-text-secondary">
          {m.realm_selected_post({ id: postId })}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {error && (
          <p className="mr-auto text-sm leading-ui text-error-text">{error}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setUrl("");
            setPostId("");
          }}
        >
          {m.common_clear()}
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={setValue.isPending || clearValue.isPending}
        >
          {m.common_save()}
        </Button>
      </div>
    </div>
  );
}
