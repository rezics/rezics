import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { Link } from "@tanstack/react-router";
import { FileText, SquareArrowOutUpRight, Vote } from "lucide-react";
import { PollComposer, PollLibrarySurface } from "@/poll";

export interface RealmPollWorkspaceProps {
  onCreatePostWithPoll?: () => void;
}

export function RealmPollWorkspace({
  onCreatePostWithPoll,
}: RealmPollWorkspaceProps) {
  const { t } = useTranslation(["common", "community"]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-md bg-surface-subtle p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <Vote className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
          <div className="min-w-0">
            <h2 className="m-0 text-lg font-medium leading-ui text-text-primary">
              {t("community:poll_workspace_title")}
            </h2>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-body text-text-secondary">
              {t("community:poll_workspace_description")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCreatePostWithPoll}
          >
            <FileText className="mr-1 h-4 w-4" />
            {t("community:poll_workspace_attach_to_post")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            render={<Link to="/poll/new" />}
          >
            <SquareArrowOutUpRight className="mr-1 h-4 w-4" />
            {t("community:poll_workspace_open_new")}
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-surface-base p-5">
        <div className="mb-5">
          <h3 className="m-0 text-base font-medium leading-ui text-text-primary">
            {t("community:poll_library_title")}
          </h3>
        </div>
        <PollLibrarySurface
          renderAction={(poll) => (
            <Button
              type="button"
              size="sm"
              variant="outline"
              render={
                <Link to="/poll/$unitId" params={{ unitId: poll.unitId }} />
              }
            >
              <SquareArrowOutUpRight className="mr-1 h-4 w-4" />
              {t("community:poll_workspace_open_new")}
            </Button>
          )}
        />
      </div>

      <div className="rounded-md bg-surface-base p-5">
        <div className="mb-5">
          <h3 className="m-0 text-base font-medium leading-ui text-text-primary">
            {t("community:poll_workspace_create_title")}
          </h3>
          <p className="m-0 mt-1 text-sm leading-body text-text-secondary">
            {t("community:poll_workspace_create_description")}
          </p>
        </div>
        <PollComposer submitLabel={t("community:poll_workspace_create")} />
      </div>
    </div>
  );
}
