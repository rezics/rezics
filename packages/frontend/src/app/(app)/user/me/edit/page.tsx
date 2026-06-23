"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/locale";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Mobile-Ultra-wide: max-w-xl mx-auto。
 *
 * 个人资料编辑页：头像上传 + 显示名称 + Bio + 保存。
 */
export default function EditProfilePage() {
  const [t] = useT();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild size="icon-sm" variant="ghost">
          <Link href="/user/me">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">{t.common.edit} Profile</h1>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="edit-name">
            Display Name
          </label>
          <Input
            id="edit-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Your display name"
            value={name}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="edit-bio">
            Bio
          </label>
          <Textarea
            className="min-h-24"
            id="edit-bio"
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..."
            value={bio}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit">{t.common.save}</Button>
          <Button asChild variant="outline">
            <Link href="/user/me">{t.common.cancel}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
