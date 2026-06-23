import * as Atom from "effect/unstable/reactivity/Atom";

// Post compose dialog state: controls visibility and target realm
// 发帖对话框状态：控制可见性和目标 realm
export const postComposeDialogAtom = Atom.make({
  open: false,
  realmSlug: "",
});
