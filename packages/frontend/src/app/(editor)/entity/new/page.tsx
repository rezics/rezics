"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createListCollection } from "@ark-ui/react/select";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const ENTITY_KINDS = [
  { value: "person", label: "Person" },
  { value: "organization", label: "Organization" },
  { value: "group", label: "Group" },
] as const;

/**
 * 实体（人物/组织）创建编辑器。
 */
export default function NewEntityPage() {
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/"><ArrowLeftIcon /></Link>
          </Button>
          <h1 className="text-lg font-semibold">New Entity</h1>
        </div>
        <Button size="sm">Create</Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="entity-name">Name</label>
          <Input id="entity-name" onChange={(e) => setName(e.target.value)} placeholder="Entity name" value={name} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Kind</label>
          <Select collection={createListCollection({ items: [...ENTITY_KINDS] })} value={["person"]}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_KINDS.map((k) => (
                <SelectItem item={k} key={k.value}>{k.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="entity-summary">Summary</label>
          <Textarea
            className="min-h-24"
            id="entity-summary"
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief description..."
            value={summary}
          />
        </div>
      </div>
    </div>
  );
}
