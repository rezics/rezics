import { redirect } from "next/navigation";

/**
 * /user/me 重定向到认证用户的个人页面。
 * 由于需要服务端 session 检查，暂时重定向到 settings。
 * 完整实现后将检查 session 并重定向到 /user/[userId]。
 */
export default function MyProfilePage() {
  redirect("/user/me/settings/account");
}
