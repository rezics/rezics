"use client";

import { Keys } from "@/atoms/keys";
import { joinRealmAtom, leaveRealmAtom, realmMembershipQuery } from "@/atoms/realms";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useState } from "react";

interface JoinButtonProps {
  readonly realmId: string;
}

/**
 * Mobile / Tablet / Desktop / Ultra-wide (all identical -- no responsive breakpoints):
 *
 * Not joined:   [  Join  ]    (primary button)
 * Joined:       [ Leave  ]    (outline button)
 *
 * 单个按钮，所有断点外观一致。已加入时直接显示"离开"操作文字
 * （无 hover-only 切换，确保触控设备功能一致）。
 * 成员身份通过单条 membership 查询判断，不拉取成员列表。
 * 边界：membership 查询中/未登录 → joined 默认 false 显示 Join。
 */
export function JoinButton({ realmId }: JoinButtonProps) {
  const [t] = useT();
  const membershipResult = useAtomValue(realmMembershipQuery(realmId));
  const joinRealm = useAtomSet(joinRealmAtom, { mode: "promise" });
  const leaveRealm = useAtomSet(leaveRealmAtom, { mode: "promise" });
  const [busy, setBusy] = useState(false);

  const joined = AsyncResult.isSuccess(membershipResult) && membershipResult.value !== null;

  const reactivityKeys = [Keys.realms, Keys.realm(realmId), Keys.realmMembers(realmId)];

  async function handleClick() {
    setBusy(true);
    try {
      if (joined) {
        const userId = membershipResult.value!.userId;
        await leaveRealm({ params: { unitId: realmId, userId }, reactivityKeys });
        toast.success({ title: t.realms.leftToast });
      } else {
        await joinRealm({ params: { unitId: realmId }, payload: {}, reactivityKeys });
        toast.success({ title: t.realms.joinedToast });
      }
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setBusy(false);
    }
  }

  if (joined) {
    return (
      <Button isLoading={busy} onClick={handleClick} variant="outline">
        {t.realms.leave}
      </Button>
    );
  }

  return (
    <Button isLoading={busy} onClick={handleClick}>
      {t.realms.join}
    </Button>
  );
}
