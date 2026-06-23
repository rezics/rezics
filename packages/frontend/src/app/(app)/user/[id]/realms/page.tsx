"use client";

import { userRealmsQuery } from "@/atoms/realms";
import { ClientOnly } from "@/components/ClientOnly";
import { RealmCard } from "@/components/realm/RealmCard";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { useParams } from "next/navigation";

function UserRealmsInner({ userId }: { readonly userId: string }) {
  const [t] = useT();
  const result = useAtomSuspense(userRealmsQuery(userId));
  const realms = result.value;

  if (realms.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        {t.user.emptyRealms}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {realms.map((realm) => (
        <RealmCard key={realm.id} realm={realm} />
      ))}
    </div>
  );
}

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | [RealmCard]                   |
 * | [RealmCard]                   |
 * | [RealmCard]                   |
 * +-------------------------------+
 * w-full, single column grid. Cards stacked with gap-3.
 *
 * Tablet (640-1023px):
 * +---------------------------------------+
 * | [RealmCard]                           |
 * | [RealmCard]                           |
 * | [RealmCard]                           |
 * +---------------------------------------+
 * Same structure, wider from parent layout.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------------------+
 * | [RealmCard]                                      |
 * | [RealmCard]                                      |
 * | [RealmCard]                                      |
 * +--------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * Ultra-wide (>=1536px):
 * +------------------------------------------------------------+
 * | [RealmCard]                                                |
 * | [RealmCard]                                                |
 * | [RealmCard]                                                |
 * +------------------------------------------------------------+
 * Same structure. Parent layout caps max-w.
 *
 * 用户加入的 realm 列表页。通过 realms.listByMember 端点获取数据。
 * 单列网格布局，复用 RealmCard 组件。所有断点布局一致。
 * 窄端：卡片 w-full 填满父级。宽端：父级 max-w 封顶。
 * 边界：0 条 -> emptyRealms 空状态。
 * 用户上下文由 layout 确立。
 */
export default function UserRealmsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <ClientOnly>
      <SectionBoundary>
        <UserRealmsInner userId={id} />
      </SectionBoundary>
    </ClientOnly>
  );
}
