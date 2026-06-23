import * as Atom from "effect/unstable/reactivity/Atom";

// Auth dialog state: controls visibility and login/register mode
// 认证对话框状态：控制可见性和登录/注册模式
export const authDialogAtom = Atom.make({
  open: false,
  mode: "login" as "login" | "register",
});
