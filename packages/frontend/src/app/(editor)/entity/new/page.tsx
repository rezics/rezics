"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale";
import { createListCollection } from "@ark-ui/react/select";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * 实体（人物/组织）创建编辑器。
 */
export default function NewEntityPage() {
  const [t] = useT();
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");

  const entityKinds = useMemo(
    () => [
      { value: "person", label: t.newEntity.kindPerson },
      { value: "organization", label: t.newEntity.kindOrganization },
      { value: "group", label: t.newEntity.kindGroup },
    ],
    [t],
  );

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link aria-label="Back" href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">{t.newEntity.heading}</h1>
        </div>
        <Button size="sm">{t.newEntity.create}</Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="entity-name">{t.newEntity.nameLabel}</label>
          <Input id="entity-name" onChange={(e) => setName(e.target.value)} placeholder={t.newEntity.namePlaceholder} value={name} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t.newEntity.kindLabel}</label>
          <Select collection={createListCollection({ items: entityKinds })} value={["person"]}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entityKinds.map((k) => (
                <SelectItem item={k} key={k.value}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="entity-summary">{t.newEntity.summaryLabel}</label>
          <Textarea
            className="min-h-24"
            id="entity-summary"
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t.newEntity.summaryPlaceholder}
            value={summary}
          />
        </div>
      </div>
    </div>
  );
}
