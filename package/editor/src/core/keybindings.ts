import { Prec } from '@codemirror/state';
import { keymap, type KeyBinding } from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';

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
