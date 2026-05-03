import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { ExcerptSource, UnitDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseAppRoute } from "@/shared/utils/parse-app-route";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { ChevronDown as ExpandMore } from "lucide-react";

interface ExcerptSourcePickerProps {
  value?: ExcerptSource;
  onChange: (value: ExcerptSource | undefined) => void;
  targetUnitId?: string;
  disabled?: boolean;
  error?: string;
  language?: string;
}

export function ExcerptSourcePicker({
  value,
  onChange,
  targetUnitId,
  disabled,
  error,
  language,
}: ExcerptSourcePickerProps) {
  const { t } = useTranslation();
  const urlInputValue = value?.mode === "url" ? value.url : "";
  const linkedUnitId = value?.mode === "unit" ? value.unitId : undefined;
  const title = value?.title ?? "";

  const titlePristineRef = useRef<boolean>(true);
  const [justUpgradedFromUnitId, setJustUpgradedFromUnitId] = useState<
    string | null
  >(null);

  const { data: linkedUnitData } = useQuery({
    ...unitQueries.detail(linkedUnitId ?? ""),
    enabled: !!linkedUnitId,
  });

  const linkedUnitTitle = linkedUnitData
    ? displayTitle(linkedUnitData, language)
    : undefined;

  useEffect(() => {
    if (
      titlePristineRef.current &&
      linkedUnitTitle &&
      value?.mode === "unit" &&
      value.title !== linkedUnitTitle
    ) {
      onChange({ ...value, title: linkedUnitTitle });
    }
  }, [linkedUnitTitle, value, onChange]);

  function handleUrlChange(raw: string) {
    const parsed = parseAppRoute(raw);
    if (parsed) {
      if (value?.mode !== "unit" || value.unitId !== parsed.unitId) {
        setJustUpgradedFromUnitId(parsed.unitId);
      }
      onChange({ mode: "unit", unitId: parsed.unitId, title });
    } else {
      if (value?.mode === "unit") {
        setJustUpgradedFromUnitId(null);
      }
      if (raw === "") {
        onChange(undefined);
        titlePristineRef.current = true;
        return;
      }
      onChange({ mode: "url", url: raw, title });
    }
  }

  function handleTitleChange(next: string) {
    titlePristineRef.current = false;
    if (!value) {
      return;
    }
    if (value.mode === "unit") {
      onChange({ ...value, title: next });
    } else {
      onChange({ ...value, title: next });
    }
  }

  function handlePickUnit(unit: UnitDTO) {
    if (!unit.id) return;
    titlePristineRef.current = true;
    const prefilled = displayTitle(unit, language) ?? title;
    onChange({ mode: "unit", unitId: unit.id, title: prefilled });
    setJustUpgradedFromUnitId(unit.id);
  }

  const displayedUrl =
    value?.mode === "unit" ? `/unit/${value.unitId}` : urlInputValue;

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t("excerpt.form.source_url", "Source URL")}
        variant="standard"
        value={displayedUrl}
        disabled={disabled}
        onChange={(e) => handleUrlChange(e.target.value)}
        error={!!error}
        helperText={error}
        fullWidth
      />

      {justUpgradedFromUnitId && linkedUnitTitle && (
        <Alert severity="info" variant="outlined" className="py-0">
          {t("excerpt.form.linked_to", "Linked to: {{title}}", {
            title: linkedUnitTitle,
          })}
        </Alert>
      )}

      {value && (
        <TextField
          label={t("excerpt.form.source_title", "Source title")}
          variant="standard"
          value={title}
          disabled={disabled}
          onChange={(e) => handleTitleChange(e.target.value)}
          inputProps={{ maxLength: 200 }}
          fullWidth
        />
      )}

      {targetUnitId && (
        <TreeDisclosure
          targetUnitId={targetUnitId}
          language={language}
          disabled={disabled}
          onPick={handlePickUnit}
        />
      )}
    </div>
  );
}

interface TreeDisclosureProps {
  targetUnitId: string;
  language?: string;
  disabled?: boolean;
  onPick: (unit: UnitDTO) => void;
}

function TreeDisclosure({
  targetUnitId,
  language,
  disabled,
  onPick,
}: TreeDisclosureProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...unitQueries.list({ workUnitId: targetUnitId, limit: 100 }),
    enabled: expanded,
  });

  const units = (data?.units ?? []) as UnitDTO[];

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, next) => setExpanded(next)}
      disabled={disabled}
      disableGutters
      elevation={0}
    >
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography variant="body2">
          {t("excerpt.form.pick_from_work", "Pick from this work")}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {isLoading && <CircularProgress size={16} />}
        {error && (
          <Typography variant="caption" color="error">
            {String(error)}
          </Typography>
        )}
        {!isLoading && !error && units.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            {t("excerpt.form.no_sub_units", "No sub-units")}
          </Typography>
        )}
        <List dense>
          {units.map((unit) => (
            <ListItemButton key={unit.id} onClick={() => onPick(unit)}>
              <ListItemText primary={displayTitle(unit, language) ?? unit.id} />
            </ListItemButton>
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  );
}

function displayTitle(unit: UnitDTO, language?: string): string | undefined {
  const t = getTranslation(
    unit.translations,
    language,
    unit.defaultLanguage ?? undefined,
  );
  return t?.title ?? undefined;
}
