import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Button,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { LANGUAGE_META, type Language } from "@rezics/contract";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Box className="flex gap-2">
        <Skeleton variant="rounded" width={72} height={28} />
        <Skeleton variant="rounded" width={72} height={28} />
      </Box>
    );
  }

  if (supportedLanguages.length === 0) return null;

  const orderedSiblings = [...siblings].sort((a, b) =>
    a.defaultLanguage.localeCompare(b.defaultLanguage),
  );

  return (
    <Stack spacing={1.25}>
      <Typography variant="caption" color="text.secondary">
        {t("post.languages", "Languages")}
      </Typography>
      <Box className="flex flex-wrap items-center gap-2">
        {orderedSiblings.map((sibling) => {
          const isCurrent = sibling.unitId === currentUnitId;
          const label = languageLabel(sibling.defaultLanguage);
          return (
            <Chip
              key={sibling.unitId}
              label={label}
              color={isCurrent ? "primary" : "default"}
              variant={isCurrent ? "filled" : "outlined"}
              clickable={!isCurrent}
              onClick={
                isCurrent
                  ? undefined
                  : () =>
                      navigate({
                        to: "/unit/$unitId",
                        params: { unitId: sibling.unitId },
                      })
              }
              title={sibling.translationSnippet ?? undefined}
            />
          );
        })}
        {currentLanguage &&
          !orderedSiblings.some(
            (s) => s.defaultLanguage === currentLanguage,
          ) && (
            <Chip
              label={languageLabel(currentLanguage)}
              color="primary"
              variant="filled"
            />
          )}
        {canAddTranslation && onAddTranslation && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddTranslation}
            variant="text"
          >
            {t("post.add_translation", "Add translation")}
          </Button>
        )}
      </Box>
    </Stack>
  );
}
