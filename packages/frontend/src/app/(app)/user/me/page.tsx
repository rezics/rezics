"use client";

import { authDialogAtom } from "@/atoms/auth-dialog";
import { authClient } from "@/lib/auth-client";
import { useAtomSet } from "@effect/atom-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /user/me -> /user/[userId] 客户端重定向。
 * 读取 better-auth session，获取当前用户 ID 后重定向到该用户主页。
 * 未登录时弹出认证对话框并回退到首页。
 * 加载期间显示空白（页面瞬间跳转，无需加载 UI）。
 */
export default function MyProfilePage() {
  const { data: session, isPending } = authClient.useSession();
  const setAuthDialog = useAtomSet(authDialogAtom);
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (session?.user?.id) {
      router.replace(`/user/${session.user.id}`);
    } else {
      setAuthDialog({ open: true, mode: "login" });
      router.replace("/");
    }
  }, [session, isPending, router, setAuthDialog]);

  return null;
}
