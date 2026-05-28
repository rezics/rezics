import type {
  AdminWorkMergeOperation,
  AdminWorkMergePreview,
} from "@rezics/api";
import { statusQueryOptions } from "@rezics/api/diagnostic/status";
import type {
  HiddenWorkDomainSummary,
  LargeWorkDomainSummary,
  WorkDomainDiagnostics,
  WorkDomainProjectionDriftSummary,
} from "@rezics/api/diagnostic/status.types";
import {
  usePreviewAdminWorkMergeMutation,
  useRevertAdminWorkMergeMutation,
  useStartAdminWorkMergeMutation,
} from "@rezics/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Separator,
  Textarea,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { GitMerge, Loader2, RotateCcw, Search } from "lucide-react";
import React from "react";
import { Page } from "@/core/layouts/Page";
import { Link } from "@/shared/ui/link";

function CountLine({
  label,
  count,
  values,
}: {
  label: string;
  count: number;
  values?: string[];
}) {
  return (
    <div className="flex flex-col gap-1 rounded-sm bg-surface-subtle p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium leading-[1.4]">{label}</span>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {values?.length ? (
        <p className="break-all text-xs leading-[1.4] text-text-secondary">
          {values.slice(0, 8).join(", ")}
          {values.length > 8 ? " ..." : ""}
        </p>
      ) : null}
    </div>
  );
}

function PreviewPanel({ preview }: { preview: AdminWorkMergePreview | null }) {
  if (!preview) {
    return (
      <Card surface="contained">
        <CardContent>
          <p className="text-sm leading-[1.4] text-text-secondary">
            輸入來源與目標 work Unit 後先預覽影響範圍。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card surface="contained">
        <CardHeader>
          <CardTitle>成員移轉</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CountLine
            label="Release memberships"
            count={preview.releaseMembershipMoves.length}
            values={preview.releaseMembershipMoves.map((row) => row.unitId)}
          />
          <CountLine
            label="Content memberships"
            count={preview.contentMembershipMoves.length}
            values={preview.contentMembershipMoves.map(
              (row) => `${row.role}:${row.unitId}`,
            )}
          />
          <CountLine
            label="Legacy release pointers"
            count={preview.legacyReleaseUnitIds.length}
            values={preview.legacyReleaseUnitIds}
          />
        </CardContent>
      </Card>

      <Card surface="contained">
        <CardHeader>
          <CardTitle>Metadata copy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CountLine
            label="Missing tags"
            count={preview.metadataCopy.tags.missing.length}
            values={preview.metadataCopy.tags.missing}
          />
          <CountLine
            label="Duplicate tags"
            count={preview.metadataCopy.tags.duplicates.length}
          />
          <CountLine
            label="Missing aliases"
            count={preview.metadataCopy.aliases.missing.length}
            values={preview.metadataCopy.aliases.missing}
          />
          <CountLine
            label="Duplicate aliases"
            count={preview.metadataCopy.aliases.duplicates.length}
          />
        </CardContent>
      </Card>

      <Card surface="contained" className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Repair scope</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CountLine
            label="Content search"
            count={preview.repairScope.contentSearchUnitIds.length}
          />
          <CountLine
            label="Post search"
            count={preview.repairScope.postSearchUnitIds.length}
          />
          <CountLine
            label="Shelves"
            count={preview.repairScope.shelfUnitIds.length}
          />
          <CountLine
            label="USWN DTOs"
            count={preview.repairScope.uswnReleaseUnitIds.length}
          />
          <CountLine
            label="Content memberships"
            count={preview.repairScope.contentMembershipUnitIds.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function OperationPanel({
  operation,
  onRevert,
  isReverting,
}: {
  operation: AdminWorkMergeOperation | null;
  onRevert: () => void;
  isReverting: boolean;
}) {
  if (!operation) return null;

  return (
    <Card surface="contained">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Operation</CardTitle>
          <Badge variant="secondary">{operation.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountLine
            label="Memberships"
            count={operation.movedMemberships.length}
          />
          <CountLine
            label="Legacy releases"
            count={operation.movedLegacyReleaseUnitIds.length}
          />
          <CountLine
            label="Copied tags"
            count={operation.createdTagKeys.length}
          />
          <CountLine
            label="Copied aliases"
            count={operation.createdAliasIds.length}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-sm bg-surface-subtle px-2 py-1 text-xs leading-[1.3]">
            {operation.id}
          </code>
          <Button
            variant="outline"
            size="sm"
            disabled={operation.status !== "COMPLETED" || isReverting}
            onClick={onRevert}
          >
            {isReverting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Revert
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkIdActions({
  unitId,
  onUseAsSource,
  onUseAsTarget,
}: {
  unitId: string;
  onUseAsSource: (unitId: string) => void;
  onUseAsTarget: (unitId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onUseAsSource(unitId)}
        type="button"
      >
        Source
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onUseAsTarget(unitId)}
        type="button"
      >
        Target
      </Button>
      <Button
        size="sm"
        variant="outline"
        render={(props) => (
          <Link to="/unit/$unitId" params={{ unitId }} {...props}>
            Inspect
          </Link>
        )}
      />
    </div>
  );
}

function ProjectionDriftRow({
  drift,
  onUseAsSource,
  onUseAsTarget,
}: {
  drift: WorkDomainProjectionDriftSummary;
  onUseAsSource: (unitId: string) => void;
  onUseAsTarget: (unitId: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-sm border border-border-whisper p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">projection</Badge>
          <span className="break-all text-xs font-mono">
            {drift.workUnitId}
          </span>
        </div>
        <p className="break-all text-xs leading-[1.4] text-text-secondary">
          Release {drift.releaseUnitId} is missing {drift.missingWorkTagCount}{" "}
          inherited work tags
          {drift.missingWorkTagIds.length
            ? `: ${drift.missingWorkTagIds.slice(0, 6).join(", ")}`
            : "."}
        </p>
      </div>
      <WorkIdActions
        unitId={drift.workUnitId}
        onUseAsSource={onUseAsSource}
        onUseAsTarget={onUseAsTarget}
      />
    </div>
  );
}

function HiddenWorkRow({
  work,
  onUseAsSource,
  onUseAsTarget,
}: {
  work: HiddenWorkDomainSummary;
  onUseAsSource: (unitId: string) => void;
  onUseAsTarget: (unitId: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-sm border border-border-whisper p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">hidden work</Badge>
          <span className="break-all text-xs font-mono">{work.workUnitId}</span>
        </div>
        <p className="text-xs leading-[1.4] text-text-secondary">
          {work.releaseCount} releases, status {work.status ?? "-"}, visibility{" "}
          {work.visibility ?? "-"}
        </p>
        {work.members.length ? (
          <p className="break-all text-xs leading-[1.4] text-text-secondary">
            {work.members
              .slice(0, 6)
              .map((member) => `${member.role}:${member.unitId}`)
              .join(", ")}
            {work.members.length > 6 ? " ..." : ""}
          </p>
        ) : null}
      </div>
      <WorkIdActions
        unitId={work.workUnitId}
        onUseAsSource={onUseAsSource}
        onUseAsTarget={onUseAsTarget}
      />
    </div>
  );
}

function LargeWorkRow({
  work,
  onUseAsSource,
  onUseAsTarget,
}: {
  work: LargeWorkDomainSummary;
  onUseAsSource: (unitId: string) => void;
  onUseAsTarget: (unitId: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-sm border border-border-whisper p-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">large domain</Badge>
          <span className="break-all text-xs font-mono">{work.workUnitId}</span>
        </div>
        <p className="text-xs leading-[1.4] text-text-secondary">
          {work.releaseCount} releases exceeds threshold {work.threshold}.
        </p>
      </div>
      <WorkIdActions
        unitId={work.workUnitId}
        onUseAsSource={onUseAsSource}
        onUseAsTarget={onUseAsTarget}
      />
    </div>
  );
}

function WorkDomainDiagnosticsPanel({
  diagnostics,
  isLoading,
  error,
  onUseAsSource,
  onUseAsTarget,
}: {
  diagnostics?: WorkDomainDiagnostics;
  isLoading: boolean;
  error: unknown;
  onUseAsSource: (unitId: string) => void;
  onUseAsTarget: (unitId: string) => void;
}) {
  const hasRows = Boolean(
    diagnostics &&
      (diagnostics.hiddenWorks.length > 0 ||
        diagnostics.projectionDrift.length > 0 ||
        diagnostics.largeDomains.length > 0),
  );

  return (
    <Card surface="contained">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Work-domain diagnostics</CardTitle>
          <Badge variant="secondary">
            {diagnostics?.item.status ?? (isLoading ? "loading" : "unknown")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="size-4 animate-spin" />
            Loading diagnostics
          </div>
        ) : error ? (
          <p className="text-sm leading-[1.4] text-error-text">
            {String(error)}
          </p>
        ) : !diagnostics ? (
          <p className="text-sm leading-[1.4] text-text-secondary">
            Diagnostics are unavailable.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <CountLine
                label="Hidden works"
                count={diagnostics.hiddenWorks.length}
              />
              <CountLine
                label="Projection drift"
                count={diagnostics.projectionDrift.length}
              />
              <CountLine
                label="Large domains"
                count={diagnostics.largeDomains.length}
              />
            </div>

            {diagnostics.item.reason ? (
              <p className="text-sm leading-[1.4] text-text-secondary">
                {diagnostics.item.reason}
              </p>
            ) : null}

            {!hasRows ? (
              <p className="text-sm leading-[1.4] text-text-secondary">
                No work-domain drift currently needs review.
              </p>
            ) : (
              <div className="grid gap-3">
                {diagnostics.projectionDrift.map((drift) => (
                  <ProjectionDriftRow
                    key={`${drift.workUnitId}:${drift.releaseUnitId}`}
                    drift={drift}
                    onUseAsSource={onUseAsSource}
                    onUseAsTarget={onUseAsTarget}
                  />
                ))}
                {diagnostics.hiddenWorks.map((work) => (
                  <HiddenWorkRow
                    key={work.workUnitId}
                    work={work}
                    onUseAsSource={onUseAsSource}
                    onUseAsTarget={onUseAsTarget}
                  />
                ))}
                {diagnostics.largeDomains.map((work) => (
                  <LargeWorkRow
                    key={work.workUnitId}
                    work={work}
                    onUseAsSource={onUseAsSource}
                    onUseAsTarget={onUseAsTarget}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function WorkMergePage() {
  const [sourceWorkUnitId, setSourceWorkUnitId] = React.useState("");
  const [targetWorkUnitId, setTargetWorkUnitId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [copyMissingTags, setCopyMissingTags] = React.useState(false);
  const [copyMissingAliases, setCopyMissingAliases] = React.useState(false);
  const [preview, setPreview] = React.useState<AdminWorkMergePreview | null>(
    null,
  );
  const [operation, setOperation] =
    React.useState<AdminWorkMergeOperation | null>(null);
  const systemStatusQuery = useQuery(statusQueryOptions.system());

  const request = React.useMemo(
    () => ({
      sourceWorkUnitId: sourceWorkUnitId.trim(),
      targetWorkUnitId: targetWorkUnitId.trim(),
      reason: reason.trim() || null,
      options: { copyMissingTags, copyMissingAliases },
    }),
    [
      sourceWorkUnitId,
      targetWorkUnitId,
      reason,
      copyMissingTags,
      copyMissingAliases,
    ],
  );

  const canSubmit =
    request.sourceWorkUnitId.length > 0 &&
    request.targetWorkUnitId.length > 0 &&
    request.sourceWorkUnitId !== request.targetWorkUnitId;

  const previewMutation = usePreviewAdminWorkMergeMutation({
    onSuccess: (data) => {
      setPreview(data);
      setOperation(null);
    },
  });
  const startMutation = useStartAdminWorkMergeMutation({
    onSuccess: (data) => setOperation(data),
  });
  const revertMutation = useRevertAdminWorkMergeMutation({
    onSuccess: (data) => setOperation(data),
  });

  return (
    <Page
      title="Work merge"
      description="Admin canonical work-domain merge, metadata copy, progress, and revert."
    >
      <div className="space-y-4">
        <Card surface="contained">
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="source-work-unit-id">Source work Unit</Label>
                <Input
                  id="source-work-unit-id"
                  value={sourceWorkUnitId}
                  onChange={(event) => setSourceWorkUnitId(event.target.value)}
                  placeholder="source work unit id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-work-unit-id">Target work Unit</Label>
                <Input
                  id="target-work-unit-id"
                  value={targetWorkUnitId}
                  onChange={(event) => setTargetWorkUnitId(event.target.value)}
                  placeholder="target work unit id"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merge-reason">Reason</Label>
              <Textarea
                id="merge-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="audit reason"
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Label className="flex items-center gap-2 text-sm leading-[1.4]">
                <Checkbox
                  checked={copyMissingTags}
                  onCheckedChange={(checked) =>
                    setCopyMissingTags(checked === true)
                  }
                />
                Copy missing tags
              </Label>
              <Label className="flex items-center gap-2 text-sm leading-[1.4]">
                <Checkbox
                  checked={copyMissingAliases}
                  onCheckedChange={(checked) =>
                    setCopyMissingAliases(checked === true)
                  }
                />
                Copy missing aliases
              </Label>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!canSubmit || previewMutation.isPending}
                onClick={() => previewMutation.mutate(request)}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Preview
              </Button>
              <Button
                disabled={!canSubmit || !preview || startMutation.isPending}
                onClick={() => startMutation.mutate(request)}
              >
                {startMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GitMerge className="size-4" />
                )}
                Start merge
              </Button>
            </div>

            {previewMutation.isError || startMutation.isError ? (
              <p className="text-sm leading-[1.4] text-error-text">
                {(previewMutation.error ?? startMutation.error)?.message ??
                  "Request failed"}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <PreviewPanel preview={preview} />
        <WorkDomainDiagnosticsPanel
          diagnostics={systemStatusQuery.data?.workDomains}
          isLoading={systemStatusQuery.isLoading}
          error={systemStatusQuery.error}
          onUseAsSource={(unitId) => setSourceWorkUnitId(unitId)}
          onUseAsTarget={(unitId) => setTargetWorkUnitId(unitId)}
        />
        <OperationPanel
          operation={operation}
          isReverting={revertMutation.isPending}
          onRevert={() => {
            if (operation) revertMutation.mutate(operation.id);
          }}
        />
        {revertMutation.isError ? (
          <p className="text-sm leading-[1.4] text-error-text">
            {revertMutation.error?.message ?? "Revert failed"}
          </p>
        ) : null}
      </div>
    </Page>
  );
}
