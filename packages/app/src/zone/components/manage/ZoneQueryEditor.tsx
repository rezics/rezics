import type {
  ContentRating,
  Language,
  PostKind,
  UnitType,
  ZoneDynamicTags,
  ZoneSectionQuery,
  ZoneSectionQuerySortField,
} from "@rezics/contract";
import {
  contentRatingValues,
  LANGUAGE_META,
  LANGUAGES,
  postKindValues,
  UnitType as UnitTypeMap,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import {
  coerceZoneQueryTarget,
  ZONE_QUERY_FILTERABLE_FIELDS,
  ZONE_QUERY_SORT_FIELDS,
  type ZoneQueryFilterField,
} from "../../models/zoneManageDraft";
import type { ZoneRefUnitMap } from "../../models/zoneMenu";
import { ZoneDynamicTagEditor } from "./ZoneDynamicTagEditor";
import { CheckGroup, ManageField, StringListEditor } from "./ZoneManageFields";
import { ZoneRealmSearchField } from "./ZoneRealmSearchField";
import { ZoneUnitSearchField } from "./ZoneUnitSearchField";

const UNIT_TYPE_OPTIONS = Object.values(UnitTypeMap) as UnitType[];
const LANGUAGE_OPTIONS = Object.values(LANGUAGES) as Language[];

const REALM_ANY = "__any__";
const REALM_CONTEXT = "context";
const REALM_IDS = "__ids__";

const LANG_ANY = "__any__";
const LANG_VIEWER = "viewer";
const LANG_LIST = "__list__";

/**
 * Query builder over the `ZoneSectionQuery` vocabulary. The visible filter
 * controls and the sortable field list follow the per-target vocabulary in
 * `models/zoneManageDraft.ts` (client mirror of the server compiler), so
 * the builder cannot produce a query the server would reject. Empty
 * multi-selects clear the field (absent = unfiltered) rather than storing
 * empty arrays.
 * 基于 `ZoneSectionQuery` 词汇表的查询构建器。可见的过滤控件与可排序
 * 字段列表遵循 `models/zoneManageDraft.ts` 中按目标划分的词汇表（服务端
 * 编译器的客户端镜像），因此构建器不会产出服务端会拒绝的查询。空的多选
 * 会清除字段（缺省 = 不过滤），而不是存储空数组。
 */
export function ZoneQueryEditor({
  query,
  dynamicTags,
  onChange,
  onDynamicTagsChange,
  refUnits,
}: {
  query: ZoneSectionQuery;
  dynamicTags?: ZoneDynamicTags;
  onChange: (query: ZoneSectionQuery) => void;
  onDynamicTagsChange?: (dynamicTags: ZoneDynamicTags | undefined) => void;
  refUnits: ZoneRefUnitMap;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const filterable: readonly ZoneQueryFilterField[] =
    ZONE_QUERY_FILTERABLE_FIELDS[query.target];
  const has = (field: ZoneQueryFilterField) => filterable.includes(field);

  const setField = <K extends keyof ZoneSectionQuery>(
    key: K,
    value: ZoneSectionQuery[K] | undefined,
  ) => {
    const next = { ...query };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  const setList = (
    key: "types" | "postKinds" | "ratings" | "tagUnitIds" | "realmTagUnitIds",
    values: readonly string[],
  ) => {
    setField(key, values.length > 0 ? ([...values] as never) : undefined);
  };

  const realmMode =
    query.realm === undefined
      ? REALM_ANY
      : query.realm === "context"
        ? REALM_CONTEXT
        : REALM_IDS;

  const languagesMode =
    query.languages === undefined
      ? LANG_ANY
      : query.languages === "viewer"
        ? LANG_VIEWER
        : LANG_LIST;

  const subjects = query.subjects;
  const setSubjects = (patch: {
    entityUnitIds?: string[];
    roles?: string[];
  }) => {
    const next = { ...subjects, ...patch };
    const entityUnitIds = next.entityUnitIds?.length
      ? next.entityUnitIds
      : undefined;
    const roles = next.roles?.length ? next.roles : undefined;
    setField(
      "subjects",
      entityUnitIds || roles ? { entityUnitIds, roles } : undefined,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ManageField label={t("zone:manage_query_target")}>
          <Select
            value={query.target}
            onValueChange={(target) =>
              onChange(
                coerceZoneQueryTarget(
                  query,
                  target as ZoneSectionQuery["target"],
                ),
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">
                {t("zone:manage_query_target_unit")}
              </SelectItem>
              <SelectItem value="post">
                {t("zone:manage_query_target_post")}
              </SelectItem>
              <SelectItem value="realm">
                {t("zone:manage_query_target_realm")}
              </SelectItem>
              <SelectItem value="zone">
                {t("zone:manage_query_target_zone")}
              </SelectItem>
            </SelectContent>
          </Select>
        </ManageField>

        <ManageField label={t("zone:manage_query_sort")}>
          <Select
            value={query.sort.field}
            onValueChange={(field) =>
              setField("sort", {
                ...query.sort,
                field: field as ZoneSectionQuerySortField,
              })
            }
          >
            <SelectTrigger className="font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZONE_QUERY_SORT_FIELDS[query.target].map((field) => (
                <SelectItem key={field} value={field} className="font-mono">
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ManageField>

        <ManageField label={t("zone:manage_query_direction")}>
          <Select
            value={query.sort.direction ?? "desc"}
            onValueChange={(direction) =>
              setField("sort", {
                ...query.sort,
                direction: direction as "asc" | "desc",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">{t("zone:manage_sort_desc")}</SelectItem>
              <SelectItem value="asc">{t("zone:manage_sort_asc")}</SelectItem>
            </SelectContent>
          </Select>
        </ManageField>
      </div>

      {has("types") ? (
        <CheckGroup
          label={t("zone:manage_query_types")}
          options={UNIT_TYPE_OPTIONS}
          values={query.types ?? []}
          onChange={(values) => setList("types", values)}
        />
      ) : null}

      {has("postKinds") ? (
        <CheckGroup
          label={t("zone:manage_query_post_kinds")}
          options={postKindValues as readonly PostKind[]}
          values={query.postKinds ?? []}
          onChange={(values) => setList("postKinds", values)}
        />
      ) : null}

      {has("ratings") ? (
        <CheckGroup
          label={t("zone:manage_query_ratings")}
          options={contentRatingValues as readonly ContentRating[]}
          values={query.ratings ?? []}
          onChange={(values) => setList("ratings", values)}
        />
      ) : null}

      {has("realm") ? (
        <div className="flex flex-col gap-3">
          <ManageField label={t("zone:manage_query_realm")}>
            <Select
              value={realmMode}
              onValueChange={(mode) => {
                if (mode === REALM_ANY) setField("realm", undefined);
                else if (mode === REALM_CONTEXT) setField("realm", "context");
                else setField("realm", { unitIds: [] });
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={REALM_ANY}>{t("common:all")}</SelectItem>
                <SelectItem value={REALM_CONTEXT}>
                  {t("zone:manage_query_realm_context")}
                </SelectItem>
                <SelectItem value={REALM_IDS}>
                  {t("zone:manage_query_realm_ids")}
                </SelectItem>
              </SelectContent>
            </Select>
          </ManageField>
          {typeof query.realm === "object" ? (
            <div className="flex flex-col gap-2 pl-4">
              <StringListEditor
                label={t("zone:manage_query_realm_ids")}
                values={query.realm.unitIds}
                onChange={(unitIds) => setField("realm", { unitIds })}
              />
              <ZoneRealmSearchField
                onPick={(realm) => {
                  const current =
                    typeof query.realm === "object" ? query.realm.unitIds : [];
                  if (current.includes(realm.unitId)) return;
                  setField("realm", { unitIds: [...current, realm.unitId] });
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {has("tagUnitIds") ? (
        <div className="flex flex-col gap-3">
          <StringListEditor
            label={t("zone:manage_query_tags")}
            values={query.tagUnitIds ?? []}
            onChange={(values) => setList("tagUnitIds", values)}
          />
          {onDynamicTagsChange ? (
            <ZoneDynamicTagEditor
              value={dynamicTags}
              onChange={onDynamicTagsChange}
              refUnits={refUnits}
            />
          ) : null}
        </div>
      ) : null}

      {has("realmTagUnitIds") ? (
        <StringListEditor
          label={t("zone:manage_query_realm_tags")}
          values={query.realmTagUnitIds ?? []}
          onChange={(values) => setList("realmTagUnitIds", values)}
        />
      ) : null}

      {has("subjects") ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StringListEditor
            label={t("zone:manage_query_subject_entities")}
            values={subjects?.entityUnitIds ?? []}
            onChange={(entityUnitIds) => setSubjects({ entityUnitIds })}
          />
          <StringListEditor
            label={t("zone:manage_query_subject_roles")}
            values={subjects?.roles ?? []}
            onChange={(roles) => setSubjects({ roles })}
          />
        </div>
      ) : null}

      {has("targetUnitId") ? (
        <ZoneUnitSearchField
          label={t("zone:manage_query_target_unit_id")}
          value={query.targetUnitId ?? ""}
          onChange={(value) =>
            setField("targetUnitId", value.trim() ? value : undefined)
          }
          refUnits={refUnits}
        />
      ) : null}

      {has("languages") ? (
        <div className="flex flex-col gap-3">
          <ManageField label={t("zone:manage_query_languages")}>
            <Select
              value={languagesMode}
              onValueChange={(mode) => {
                if (mode === LANG_ANY) setField("languages", undefined);
                else if (mode === LANG_VIEWER) setField("languages", "viewer");
                else setField("languages", []);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LANG_ANY}>{t("common:all")}</SelectItem>
                <SelectItem value={LANG_VIEWER}>
                  {t("zone:manage_query_languages_viewer")}
                </SelectItem>
                <SelectItem value={LANG_LIST}>
                  {t("zone:manage_query_languages_list")}
                </SelectItem>
              </SelectContent>
            </Select>
          </ManageField>
          {Array.isArray(query.languages) ? (
            <div className="pl-4">
              <CheckGroup
                label={t("zone:manage_query_languages_list")}
                options={LANGUAGE_OPTIONS}
                values={query.languages}
                onChange={(values) => setField("languages", values)}
                renderOption={(option) => LANGUAGE_META[option].nativeName}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
