import { realmDetailQuery } from "@rezics/api/realm/realm";
import { userQueries } from "@rezics/api/user/user";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildHeaderSubmitPath } from "./buildHeaderSubmitPath";
import LogoIcon from "@/shared/assets/logo.svg?react";
import { cn } from "@/shared/utils/css-util";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { useUserProfileStore } from "@/user/states";

type HeaderSearchScope =
  | { kind: "general" }
  | { kind: "realm"; realmId: string }
  | { kind: "userId"; userId: string }
  | { kind: "userSlug"; userSlug: string };

function firstRouteSegment(pathname: string, segment: string): string | null {
  const match = pathname.match(new RegExp(`^/${segment}/([^/]+)`));
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]);
}

function resolveScope(pathname: string): HeaderSearchScope {
  const realmId = firstRouteSegment(pathname, "realm");
  if (realmId && realmId !== "search" && realmId !== "new") {
    return { kind: "realm", realmId };
  }

  const userId = firstRouteSegment(pathname, "user");
  if (userId) {
    return { kind: "userId", userId };
  }

  const userSlug = firstRouteSegment(pathname, "u");
  if (userSlug) {
    return { kind: "userSlug", userSlug };
  }

  return { kind: "general" };
}

function useHeaderSearchPresentation(pathname: string) {
  const scope = useMemo(() => resolveScope(pathname), [pathname]);
  const currentUser = useUserProfileStore((state) => state.user);

  const realmId = scope.kind === "realm" ? scope.realmId : "";
  const userId =
    scope.kind === "userId" && scope.userId !== "me" ? scope.userId : "";
  const userSlug = scope.kind === "userSlug" ? scope.userSlug : "";

  const realmQuery = useQuery({
    ...realmDetailQuery(realmId),
    enabled: Boolean(realmId),
  });
  const userByIdQuery = useQuery({
    ...userQueries.detail(userId),
    enabled: Boolean(userId),
  });
  const userBySlugQuery = useQuery({
    ...userQueries.bySlug(userSlug),
    enabled: Boolean(userSlug),
  });

  if (scope.kind === "realm") {
    const title =
      getTranslation(
        realmQuery.data?.translations,
        undefined,
        realmQuery.data?.defaultLanguage ?? undefined,
      )?.title ?? scope.realmId;

    return {
      kind: "scoped" as const,
      badge: `r/${title}`,
      avatar: null,
      fallback: null,
      showAvatar: false,
      placeholder: "搜尋此 realm",
    };
  }

  if (scope.kind === "userId" || scope.kind === "userSlug") {
    const user =
      scope.kind === "userId" && scope.userId === "me"
        ? currentUser
        : scope.kind === "userId"
          ? userByIdQuery.data
          : userBySlugQuery.data;
    const handle =
      user?.slug ??
      user?.name ??
      (scope.kind === "userId" ? scope.userId : scope.userSlug);

    return {
      kind: "scoped" as const,
      badge: `u/${handle}`,
      avatar: user?.avatar ?? null,
      fallback: handle.charAt(0).toUpperCase(),
      showAvatar: true,
      placeholder: "搜尋此使用者",
    };
  }

  return {
    kind: "general" as const,
    badge: null,
    avatar: null,
    fallback: null,
    showAvatar: false,
    placeholder: pathname.startsWith("/book")
      ? "搜尋書籍、書評、書單..."
      : "Find anything",
  };
}

export function HeaderSearch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isMobile = useIsMobile();
  const isHomePage = pathname === "/";
  const presentation = useHeaderSearchPresentation(pathname);
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const submit = () => {
    navigate({ to: buildHeaderSubmitPath(pathname, value) });
  };

  if (isMobile) {
    if (isHomePage) return null;

    return (
      <Button
        size="icon"
        variant="ghost"
        className={cn("h-9 w-9 shrink-0 text-text-primary", className)}
        aria-label={t("accessibility.search")}
        onClick={submit}
      >
        <SearchIcon className="h-5 w-5" />
      </Button>
    );
  }

  const leading =
    presentation.kind === "general" ? (
      <LogoIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
    ) : (
      <SearchIcon className="h-4 w-4 shrink-0 text-text-secondary" />
    );

  return (
    <form
      className={cn(
        "flex h-10 w-full max-w-[560px] items-center gap-2 rounded-full bg-surface-elevated px-4 md:px-5",
        "border border-border-whisper focus-within:border-border-focus",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {leading}
      {presentation.badge && (
        <span className="flex h-8 max-w-40 shrink-0 items-center gap-1.5 truncate rounded-full bg-surface-subtle px-2 text-xs leading-dense text-text-secondary">
          {presentation.showAvatar && (
            <Avatar size="sm" className="rounded-full">
              {presentation.avatar && (
                <AvatarImage
                  src={presentation.avatar}
                  alt={presentation.badge}
                  className="rounded-full"
                />
              )}
              <AvatarFallback className="rounded-full">
                {presentation.fallback}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="min-w-0 truncate">{presentation.badge}</span>
        </span>
      )}
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={presentation.placeholder}
        aria-label={t("accessibility.search")}
        className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
    </form>
  );
}
