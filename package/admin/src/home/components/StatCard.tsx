import { Card, CardContent } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  color?: string;
  href?: string;
}

export function StatCard({ label, value, icon, color, href }: StatCardProps) {
  const navigate = useNavigate();

  const content = (
    <CardContent>
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="flex"
            style={
              color ? { color } : { color: "var(--rezics-sys-color-primary)" }
            }
          >
            {icon}
          </div>
        )}
        <div>
          <span className="text-[0.6875rem] uppercase tracking-wider text-text-secondary">
            {label}
          </span>
          <h2
            className="text-2xl font-extrabold"
            style={color ? { color } : undefined}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </h2>
        </div>
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Card
        className="cursor-pointer transition-colors hover:bg-surface-elevated"
        onClick={() => navigate({ to: href })}
      >
        {content}
      </Card>
    );
  }

  return <Card>{content}</Card>;
}
