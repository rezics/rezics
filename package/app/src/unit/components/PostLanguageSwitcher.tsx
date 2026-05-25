import { LANGUAGE_META, type Language } from "@rezics/contract";
import { post_add_translation, post_languages } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Badge, Button, Skeleton } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { Plus as AddIcon } from "lucide-react";

const i18nMessages = {
  post_add_translation,
  post_languages,
};

type Sibling = {
  unitId: string;
  defaultLanguage: string;
  translationSnippet: string | null;
};

interface PostLanguageSwitcherProps {
  currentUnitId: string;
  currentLanguage: string | null | undefined;
  supportedLanguages: string[];
  siblings: Sibling[];
  isLoading?: boolean;
  canAddTranslation?: boolean;
  onAddTranslation?: () => void;
}

function languageLabel(code: string): string {
  const meta = LANGUAGE_META[code as Language];
  return meta?.nativeName ?? code;
}

export function PostLanguageSwitcher({
  currentUnitId,
  currentLanguage,
  supportedLanguages,
  siblings,
  isLoading,
  canAddTranslation,
  onAddTranslation,
}: PostLanguageSwitcherProps) {
  const m = useMessage(i18nMessages);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="w-[72px] h-7 rounded-md" />
        <Skeleton className="w-[72px] h-7 rounded-md" />
      </div>
    );
  }

  if (supportedLanguages.length === 0) return null;

  const orderedSiblings = [...siblings].sort((a, b) =>
    a.defaultLanguage.localeCompare(b.defaultLanguage),
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-text-secondary">{m.post_languages()}</span>
      <div className="flex flex-wrap items-center gap-2">
        {orderedSiblings.map((sibling) => {
          const isCurrent = sibling.unitId === currentUnitId;
          const label = languageLabel(sibling.defaultLanguage);
          return (
            <Badge
              key={sibling.unitId}
              variant={isCurrent ? "default" : "outline"}
              className={isCurrent ? undefined : "cursor-pointer"}
              onClick={
                isCurrent
                  ? undefined
                  : () =>
                      navigate({
                        to: "/unit/$unitId",
                        params: { unitId: sibling.unitId },
                        search: { view: "auto" },
                      })
              }
              title={sibling.translationSnippet ?? undefined}
            >
              {label}
            </Badge>
          );
        })}
        {currentLanguage &&
          !orderedSiblings.some(
            (s) => s.defaultLanguage === currentLanguage,
          ) && (
            <Badge variant="default">{languageLabel(currentLanguage)}</Badge>
          )}
        {canAddTranslation && onAddTranslation && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onAddTranslation}
            className="gap-1"
          >
            <AddIcon className="h-4 w-4" />
            {m.post_add_translation()}
          </Button>
        )}
      </div>
    </div>
  );
}
