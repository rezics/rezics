import * as m from "@rezics/i18n/messages";
import { useEntityWorks } from "../hooks/useEntityWorks";

interface WorksTabProps {
  entityUnitId: string;
}

export function WorksTab({ entityUnitId }: WorksTabProps) {
  const { works, isLoading } = useEntityWorks(entityUnitId);
  if (isLoading) {
    return (
      <p className="text-sm text-text-secondary">{m.entity_loading_works()}</p>
    );
  }
  if (works.length === 0) {
    return <p className="text-sm text-text-secondary">{m.entity_no_works()}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {works.map((w) => (
        <li
          key={w.unitId}
          className="rounded-md border border-border-whisper p-3 text-sm text-text-primary"
        >
          <span className="mr-2 text-xs uppercase text-text-secondary">
            {w.type}
          </span>
          {w.title}
          <span className="ml-2 text-xs text-text-secondary">{w.role}</span>
        </li>
      ))}
    </ul>
  );
}
