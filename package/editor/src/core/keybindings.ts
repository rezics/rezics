import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { Prec } from "@codemirror/state";
import { type KeyBinding, keymap } from "@codemirror/view";

export function mergeKeybindings(
  consumerBindings: KeyBinding[],
  pluginBindings: KeyBinding[],
) {
  return [
    Prec.highest(keymap.of(consumerBindings)),
    Prec.default(keymap.of(pluginBindings)),
    Prec.low(keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab])),
    history(),
  ];
}
