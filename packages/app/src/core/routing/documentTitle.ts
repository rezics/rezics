import type {
  BookDTO,
  EntityDTO,
  PollDTO,
  PostDTO,
  RealmDTO,
  ShelfDTO,
  UnitDTO,
  UnitTagDTO,
  UnitTranslationDTO,
  UserDTO,
  ZoneDTO,
} from "@rezics/contract";
import type { ResolvedReadLanguageContext } from "@/shared/models/readLanguageContext";

export const SITE_TITLE = "Rezics";
export const DOCUMENT_TITLE_SEPARATOR = " : ";

export type DocumentTitleUnitKind =
  | "book"
  | "post"
  | "realm"
  | "zone"
  | "user"
  | "shelf"
  | "entity"
  | "poll"
  | "tag"
  | "unit"
  | "page"
  | "product";

export type DocumentTitleSubject = {
  title: string | null | undefined;
  unitKind: DocumentTitleUnitKind;
};

export type DocumentTitleContext = {
  title: string | null | undefined;
  unitKind: DocumentTitleUnitKind;
};

export type DocumentTitleContract = {
  subject: DocumentTitleSubject;
  contexts?: readonly DocumentTitleContext[];
};

const UNIT_KIND_TITLE_POLICY = {
  book: { label: "book", render: true },
  post: { label: "post", render: false },
  realm: { label: "realm", render: false },
  zone: { label: "zone", render: false },
  user: { label: "user", render: false },
  shelf: { label: "shelf", render: false },
  entity: { label: "entity", render: false },
  poll: { label: "poll", render: false },
  tag: { label: "tag", render: false },
  unit: { label: "unit", render: false },
  page: { label: "page", render: false },
  product: { label: "product", render: false },
} as const satisfies Record<
  DocumentTitleUnitKind,
  { label: string; render: boolean }
>;

const CONTEXT_TITLE_PREFIX = {
  book: null,
  post: null,
  realm: "r/",
  zone: "z/",
  user: null,
  shelf: null,
  entity: null,
  poll: null,
  tag: null,
  unit: null,
  page: null,
  product: null,
} as const satisfies Record<DocumentTitleUnitKind, string | null>;

export function titleSubject(
  unitKind: DocumentTitleUnitKind,
  title: string | null | undefined,
): DocumentTitleSubject {
  return { unitKind, title };
}

export function titleContext(
  unitKind: DocumentTitleUnitKind,
  title: string | null | undefined,
): DocumentTitleContext {
  return { unitKind, title };
}

export function titleContract(input: {
  subject: DocumentTitleSubject;
  contexts?: readonly DocumentTitleContext[];
}): DocumentTitleContract {
  return input;
}

export async function parentRouteLoaderData<T>(
  parentMatchPromise: Promise<{ loaderData?: unknown }>,
): Promise<T> {
  const parentMatch = await parentMatchPromise;
  return parentMatch.loaderData as T;
}

export function documentTitle(contract: DocumentTitleContract): string {
  const policy = UNIT_KIND_TITLE_POLICY[contract.subject.unitKind];
  const contextTitles = (contract.contexts ?? []).map((context) => {
    const title = context.title?.trim();
    if (!title) return null;
    return `${CONTEXT_TITLE_PREFIX[context.unitKind] ?? ""}${title}`;
  });
  const normalizedParts = [
    contract.subject.title,
    policy.render ? policy.label : null,
    ...contextTitles,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return normalizedParts.join(DOCUMENT_TITLE_SEPARATOR);
}

export function titleMeta(contract: DocumentTitleContract) {
  return {
    meta: [{ title: documentTitle(contract) }],
  };
}

export function unitTitleMeta(
  unitKind: DocumentTitleUnitKind,
  title: string | null | undefined,
  contexts?: readonly DocumentTitleContext[],
) {
  return titleMeta(
    titleContract({ subject: titleSubject(unitKind, title), contexts }),
  );
}

export function productTitleMeta() {
  return titleMeta({ subject: titleSubject("product", SITE_TITLE) });
}

function firstNonEmpty(...values: (string | null | undefined)[]) {
  return values.find((value) => value?.trim())?.trim() ?? null;
}

function titleFromTranslations(
  translations: readonly UnitTranslationDTO[] | undefined,
  readContext?: ResolvedReadLanguageContext,
): string | null {
  if (!translations?.length) return null;
  const byLanguage = new Map(
    translations.map((translation) => [translation.language, translation]),
  );
  const orderedLanguages = [
    readContext?.appLocale,
    ...(readContext?.languages ?? []),
  ];
  for (const language of orderedLanguages) {
    if (!language) continue;
    const title = byLanguage.get(language)?.title;
    if (title?.trim()) return title.trim();
  }
  return (
    translations
      .find((translation) => translation.title?.trim())
      ?.title?.trim() ?? null
  );
}

export function titleOfTranslatedUnit(
  unit:
    | Pick<UnitDTO, "title" | "translations" | "slug" | "id">
    | Pick<BookDTO, "title" | "translations" | "unitId">
    | Pick<RealmDTO, "title" | "translations" | "slug" | "unitId">
    | Pick<ShelfDTO, "title" | "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
): string | null {
  return firstNonEmpty(
    "title" in unit ? unit.title : null,
    titleFromTranslations(unit.translations, readContext),
  );
}

export function titleOfBook(
  book: Pick<BookDTO, "title" | "translations" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleOfTranslatedUnit(book, readContext);
}

export function titleOfRealm(
  realm: Pick<RealmDTO, "title" | "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleOfTranslatedUnit(realm, readContext);
}

export function titleOfZone(zone: Pick<ZoneDTO, "name" | "slug" | "unitId">) {
  return firstNonEmpty(zone.name);
}

export function titleOfPost(post: Pick<PostDTO, "title" | "unitId">) {
  return firstNonEmpty(post.title);
}

export function titleOfShelf(
  shelf: Pick<ShelfDTO, "title" | "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleOfTranslatedUnit(shelf, readContext);
}

export function titleOfTag(
  tag: UnitTagDTO &
    Partial<{
      title: string | null;
      name: string | null;
      label: string | null;
    }>,
) {
  return firstNonEmpty(tag.title, tag.name, tag.label);
}

export function titleOfEntity(
  entity: Pick<EntityDTO, "translations" | "slug" | "unitId">,
  readContext?: ResolvedReadLanguageContext,
) {
  return titleFromTranslations(entity.translations, readContext);
}

export function titleOfUser(user: Pick<UserDTO, "name" | "slug" | "unitId">) {
  return firstNonEmpty(user.name);
}

export function titleOfPoll(
  poll: Pick<PollDTO, "title"> & {
    unitId?: string | null;
    pollUnitId?: string | null;
  },
) {
  return firstNonEmpty(poll.title);
}

export function loaderDataByRouteId<T>(
  matches: readonly { routeId: string; loaderData?: unknown }[],
  routeId: string,
): T | null {
  return (
    (matches.find((match) => match.routeId === routeId)?.loaderData as
      | T
      | undefined) ?? null
  );
}
