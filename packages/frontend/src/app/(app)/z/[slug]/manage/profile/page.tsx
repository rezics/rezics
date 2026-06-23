"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useState } from "react";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Profile                     |
 * |-----------------------------|
 * | Zone Name                   |
 * | [input                   ]  |
 * | Slug                        |
 * | [input                   ]  |
 * | Description                 |
 * | [textarea                ]  |
 * |              [Save Changes] |
 * +-----------------------------+
 * w-full，表单单列。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Profile                              |
 * | Zone Name  [input               ]    |
 * | Slug       [input               ]    |
 * | Description [textarea            ]   |
 * |                      [Save Changes]  |
 * +--------------------------------------+
 * max-w-2xl 居中。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [manage nav] | Profile                   |
 * |              | Zone Name  [input       ]  |
 * |              | Slug       [input       ]  |
 * |              | Description [textarea   ]  |
 * |              |         [Save Changes]    |
 * +------------------------------------------+
 * 侧边导航 + 表单区 flex-1，max-w-2xl。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * Zone 简介编辑页面：名称、slug、描述表单。
 * 当前为占位实现，表单提交待 API 接入后连接。
 */

function ManageZoneProfileContent() {
  const [t] = useT();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">{t.zone.manageProfile}</h1>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="zone-name">
            {t.zone.zoneName}
          </label>
          <Input
            id="zone-name"
            onChange={(e) => setName(e.target.value)}
            value={name}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="zone-slug">
            {t.zone.zoneSlug}
          </label>
          <Input
            id="zone-slug"
            onChange={(e) => setSlug(e.target.value)}
            value={slug}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="zone-description">
            {t.zone.zoneDescription}
          </label>
          <Textarea
            id="zone-description"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
          />
          <p className="text-muted-foreground text-xs">{t.zone.zoneDescriptionHint}</p>
        </div>

        <div className="flex justify-end">
          <Button type="submit">{t.zone.saveChanges}</Button>
        </div>
      </form>
    </div>
  );
}

export default function ManageZoneProfilePage() {
  return (
    <SectionBoundary>
      <ClientOnly>
        <ManageZoneProfileContent />
      </ClientOnly>
    </SectionBoundary>
  );
}
