import { useTranslation } from "@rezics/i18n/react";
import { RezicsJsonEditor } from "@rezics/ui/editor";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
} from "@rezics/ui/shadcn";
import { Braces, ListTree, RotateCcw } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ZoneManageDraft,
  ZoneManageJsonProblem,
  ZoneManageJsonTarget,
} from "../../models/zoneManageDraft";
import {
  applyZoneManageJsonBody,
  parseZoneManageJsonText,
  zoneManageJsonKey,
  zoneManageJsonText,
} from "../../models/zoneManageDraft";

type ViewMode = "form" | "json";

function formatProblems(problems: readonly ZoneManageJsonProblem[]): string[] {
  return problems.map((problem) =>
    problem.path === "/"
      ? problem.message
      : `${problem.path}: ${problem.message}`,
  );
}

/**
 * Paired structured/JSON editor for one zone envelope body. Invalid JSON or
 * contract-invalid bodies intentionally keep the structured view locked until
 * the text is fixed or reverted, so two divergent draft representations cannot
 * overwrite each other.
 */
export function ZoneManageJsonFrame({
  draft,
  onDraftChange,
  target,
  onProblemsChange,
  children,
}: {
  draft: ZoneManageDraft;
  onDraftChange: (draft: ZoneManageDraft) => void;
  target: ZoneManageJsonTarget;
  onProblemsChange: (key: string, problems: string[]) => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["zone", "common"]);
  const targetKey = zoneManageJsonKey(target);
  const [mode, setMode] = useState<ViewMode>("form");
  const [text, setText] = useState(() => zoneManageJsonText(draft, target));
  const [problems, setProblems] = useState<string[]>([]);
  const clearProblems = useCallback(() => {
    setProblems((current) => (current.length === 0 ? current : []));
  }, []);

  useEffect(() => {
    setMode("form");
    setText(zoneManageJsonText(draft, target));
    clearProblems();
  }, [clearProblems, draft, target]);

  useEffect(() => {
    onProblemsChange(targetKey, problems);
    return () => onProblemsChange(targetKey, []);
  }, [onProblemsChange, problems, targetKey]);

  const diagnostics = useCallback(
    (value: string) => {
      const parsed = parseZoneManageJsonText(target, value);
      if (parsed.ok) return [];
      return formatProblems(parsed.problems).map((message) => ({ message }));
    },
    [target],
  );

  const formattedProblems = useMemo(
    () => problems.map((problem) => <li key={problem}>{problem}</li>),
    [problems],
  );

  const openJson = () => {
    setText(zoneManageJsonText(draft, target));
    clearProblems();
    setMode("json");
  };

  const openForm = () => {
    if (problems.length > 0) return;
    setMode("form");
  };

  const revertJson = () => {
    setText(zoneManageJsonText(draft, target));
    clearProblems();
  };

  const updateJson = (next: string) => {
    setText(next);
    const parsed = parseZoneManageJsonText(target, next);
    if (!parsed.ok) {
      setProblems(formatProblems(parsed.problems));
      return;
    }
    clearProblems();
    onDraftChange(applyZoneManageJsonBody(draft, target, parsed.body));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "form" ? "default" : "outline"}
          disabled={mode === "form" || problems.length > 0}
          onClick={openForm}
        >
          <ListTree className="size-4" aria-hidden />
          {t("zone:manage_view_form")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "json" ? "default" : "outline"}
          disabled={mode === "json"}
          onClick={openJson}
        >
          <Braces className="size-4" aria-hidden />
          JSON
        </Button>
        {mode === "json" ? (
          <Button type="button" size="sm" variant="ghost" onClick={revertJson}>
            <RotateCcw className="size-4" aria-hidden />
            {t("zone:manage_json_revert")}
          </Button>
        ) : null}
      </div>

      {mode === "json" ? (
        <div className="flex flex-col gap-3">
          {problems.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc pl-4">{formattedProblems}</ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <Card surface="contained">
            <CardContent className="p-3">
              <RezicsJsonEditor
                value={text}
                onChange={updateJson}
                diagnostics={diagnostics}
                resize={{ height: 512, minHeight: 320, maxHeight: 960 }}
                className="overflow-hidden rounded-md"
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
