import { Card, CardContent } from "@rezics/ui/shadcn";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_health_meili,
  admin_health_server,
  admin_health_system,
} from "@rezics/i18n/messages";
const i18nMessages = {
  admin_health_meili,
  admin_health_server,
  admin_health_system,
};

interface HealthStripProps {
  server: "ok" | "degraded";
  meili: "ok" | "unreachable";
}

function StatusDot({ status }: { status: "ok" | "degraded" | "unreachable" }) {
  const cls = status === "ok" ? "bg-success-fill" : "bg-error-fill";
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cls}`} />;
}

export function HealthStrip({ server, meili }: HealthStripProps) {
  const m = useMessage(i18nMessages);
  return (
    <Card>
      <CardContent className="flex gap-8 items-center py-3">
        <span className="text-[0.6875rem] uppercase tracking-wider text-text-secondary mr-2">
          {m.admin_health_system()}
        </span>
        <div className="flex items-center gap-2">
          <StatusDot status={server} />
          <span className="text-sm">
            {m.admin_health_server({ status: server })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={meili} />
          <span className="text-sm">
            {m.admin_health_meili({ status: meili })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
