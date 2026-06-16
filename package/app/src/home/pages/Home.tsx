import type { StreamQuery } from "@rezics/api/stream/stream";
import { useTranslation } from "@rezics/i18n/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@rezics/ui/shadcn";
import type React from "react";
import { useMemo, useState } from "react";
import { MainContentContainer } from "@/core";
import { StreamLayout, StreamSection } from "@/stream";

export type HomeProps = object;

type HomeStreamSort = NonNullable<StreamQuery["sort"]>;
type HomeStreamType = NonNullable<StreamQuery["filterType"]>;

const HOME_STREAM_SORT_OPTIONS: readonly HomeStreamSort[] = [
  "best",
  "hot",
  "new",
  "top",
  "rising",
];

const HOME_STREAM_TYPE_OPTIONS: readonly HomeStreamType[] = [
  "all",
  "book",
  "game",
  "media",
  "post",
  "review",
  "realm",
  "zone",
];

const SORT_I18N_KEYS: Record<HomeStreamSort, string> = {
  best: "entity:stream_sort_best",
  hot: "entity:stream_sort_hot",
  new: "entity:stream_sort_new",
  top: "entity:stream_sort_top",
  rising: "entity:stream_sort_rising",
};

const TYPE_I18N_KEYS: Record<HomeStreamType, string> = {
  all: "page:home_stream_type_all",
  book: "page:home_stream_type_book",
  game: "page:home_stream_type_game",
  media: "page:home_stream_type_media",
  post: "page:home_stream_type_post",
  review: "page:home_stream_type_review",
  realm: "page:home_stream_type_realm",
  zone: "page:home_stream_type_zone",
};

export const Home: React.FC<HomeProps> = () => {
  const { t } = useTranslation(["entity", "page"]);
  const [sort, setSort] = useState<HomeStreamSort>("best");
  const [type, setType] = useState<HomeStreamType>("all");
  const streamQuery = useMemo(
    () =>
      ({
        scope: "home",
        sort,
        filterType: type,
        limit: 12,
      }) satisfies StreamQuery,
    [sort, type],
  );

  return (
    <MainContentContainer className="mb-16 space-y-6 pt-6 md:pt-8">
      <StreamLayout>
        <section>
          <div className="w-full">
            <div className="space-y-2 mb-4">
              <h1 className="text-2xl font-semibold leading-snug">
                <span className="text-brand">
                  {t("page:home_hero_title_highlight")}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {t("page:home_hero_subtitle")}
              </p>
            </div>
          </div>
        </section>
      </StreamLayout>

      <StreamLayout>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
          <Select
            value={sort}
            onValueChange={(next) => setSort(next as HomeStreamSort)}
          >
            <SelectTrigger
              className="w-full sm:w-40"
              aria-label={t("entity:stream_sort_label")}
            >
              <SelectValue>{t(SORT_I18N_KEYS[sort])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("entity:stream_sort_label")}</SelectLabel>
                {HOME_STREAM_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(SORT_I18N_KEYS[option])}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(next) => setType(next as HomeStreamType)}
          >
            <SelectTrigger
              className="w-full sm:w-40"
              aria-label={t("page:home_stream_type_label")}
            >
              <SelectValue>{t(TYPE_I18N_KEYS[type])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("page:home_stream_type_label")}</SelectLabel>
                {HOME_STREAM_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(TYPE_I18N_KEYS[option])}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <StreamSection query={streamQuery} />
      </StreamLayout>
    </MainContentContainer>
  );
};
