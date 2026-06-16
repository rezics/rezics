import type { FeedQuery } from "@rezics/api/feed/feed";
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
import { FeedLayout, FeedSection } from "@/feed";

export type HomeProps = object;

type HomeFeedSort = NonNullable<FeedQuery["sort"]>;
type HomeFeedType = NonNullable<FeedQuery["filterType"]>;

const HOME_FEED_SORT_OPTIONS: readonly HomeFeedSort[] = [
  "best",
  "hot",
  "new",
  "top",
  "rising",
];

const HOME_FEED_TYPE_OPTIONS: readonly HomeFeedType[] = [
  "all",
  "book",
  "game",
  "media",
  "post",
  "review",
  "realm",
  "zone",
];

const SORT_I18N_KEYS: Record<HomeFeedSort, string> = {
  best: "entity:realm_feed_sort_best",
  hot: "entity:realm_feed_sort_hot",
  new: "entity:realm_feed_sort_new",
  top: "entity:realm_feed_sort_top",
  rising: "entity:realm_feed_sort_rising",
};

const TYPE_I18N_KEYS: Record<HomeFeedType, string> = {
  all: "page:home_feed_type_all",
  book: "page:home_feed_type_book",
  game: "page:home_feed_type_game",
  media: "page:home_feed_type_media",
  post: "page:home_feed_type_post",
  review: "page:home_feed_type_review",
  realm: "page:home_feed_type_realm",
  zone: "page:home_feed_type_zone",
};

export const Home: React.FC<HomeProps> = () => {
  const { t } = useTranslation(["entity", "page"]);
  const [sort, setSort] = useState<HomeFeedSort>("best");
  const [type, setType] = useState<HomeFeedType>("all");
  const feedQuery = useMemo(
    () =>
      ({
        scope: "home",
        sort,
        filterType: type,
        limit: 12,
      }) satisfies FeedQuery,
    [sort, type],
  );

  return (
    <MainContentContainer className="mb-16 space-y-6 pt-6 md:pt-8">
      <FeedLayout>
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
      </FeedLayout>

      <FeedLayout>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start">
          <Select
            value={sort}
            onValueChange={(next) => setSort(next as HomeFeedSort)}
          >
            <SelectTrigger
              className="w-full sm:w-40"
              aria-label={t("entity:realm_feed_sort_label")}
            >
              <SelectValue>{t(SORT_I18N_KEYS[sort])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("entity:realm_feed_sort_label")}</SelectLabel>
                {HOME_FEED_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(SORT_I18N_KEYS[option])}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(next) => setType(next as HomeFeedType)}
          >
            <SelectTrigger
              className="w-full sm:w-40"
              aria-label={t("page:home_feed_type_label")}
            >
              <SelectValue>{t(TYPE_I18N_KEYS[type])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t("page:home_feed_type_label")}</SelectLabel>
                {HOME_FEED_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(TYPE_I18N_KEYS[option])}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <FeedSection query={feedQuery} />
      </FeedLayout>
    </MainContentContainer>
  );
};
