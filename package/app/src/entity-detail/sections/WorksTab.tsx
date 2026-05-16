import { useEntityWorks } from "../hooks/useEntityWorks";

interface WorksTabProps {
  entityUnitId: string;
}

export function WorksTab({ entityUnitId }: WorksTabProps) {
  const { works } = useEntityWorks(entityUnitId);
  if (works.length === 0) {
    return <p className="text-sm text-text-secondary">No works yet.</p>;
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
        </li>
      ))}
    </ul>
  );
}
