import * as m from "@rezics/i18n/messages";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";

export interface MeiliAction {
  id: string;
  label: string;
  pendingLabel: string;
  isPending: boolean;
  onClick: () => void;
  variant?: "default" | "outline";
}

function ActionButtons({ actions }: { actions: MeiliAction[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant}
          size="sm"
          onClick={action.onClick}
          disabled={action.isPending}
        >
          {action.isPending ? action.pendingLabel : action.label}
        </Button>
      ))}
    </div>
  );
}

export function MeiliOperationsSection({
  initActions,
  syncActions,
}: {
  initActions: MeiliAction[];
  syncActions: MeiliAction[];
}) {
  return (
    <div className="space-y-4">
      <Card className="border-border-whisper bg-surface-base">
        <CardHeader>
          <CardTitle>{m.admin_meili_index_initialization_title()}</CardTitle>
          <CardDescription>
            {m.admin_meili_index_initialization_description()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionButtons actions={initActions} />
        </CardContent>
      </Card>

      <Card className="border-border-whisper bg-surface-base">
        <CardHeader>
          <CardTitle>{m.admin_meili_full_sync_title()}</CardTitle>
          <CardDescription>
            {m.admin_meili_full_sync_description()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ActionButtons actions={syncActions} />
          <p className="text-xs leading-[1.4] text-text-secondary">
            {m.admin_meili_sync_help()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
