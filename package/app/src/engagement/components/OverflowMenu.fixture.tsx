import type { Action } from "../types";
import { OverflowMenu } from "./OverflowMenu";

const logInvoke = (action: Action) => {
  // eslint-disable-next-line no-console
  console.log("Overflow action invoked:", action);
};

export default {
  "md · shelf + share": () => (
    <OverflowMenu size="md" items={["shelf", "share"]} onInvoke={logInvoke} />
  ),
  "sm · reply only": () => (
    <OverflowMenu size="sm" items={["reply"]} onInvoke={logInvoke} />
  ),
  "lg · all overflow tokens": () => (
    <OverflowMenu
      size="lg"
      items={["reply", "share", "shelf"]}
      onInvoke={logInvoke}
    />
  ),
};
