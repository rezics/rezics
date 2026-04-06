import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface DialogEntry {
  visible: boolean;
  contentMain?: string;
}

interface DialogState {
  dialogs: Record<string, DialogEntry>;
  setDialogVisible: (key: string, visible: boolean) => void;
  setDialogContent: (key: string, content: string) => void;
  getDialogEntry: (key: string) => DialogEntry | undefined;
}

// Helper：保证每次访问一个 key 都有结构
const ensureEntry = (state: DialogState, key: string): DialogEntry => {
  if (!state.dialogs[key]) {
    state.dialogs[key] = { visible: false, contentMain: "" };
  }
  return state.dialogs[key];
};

export const useDialogStore = create<DialogState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        dialogs: {},

        setDialogVisible: (key, visible) =>
          set(
            (state) => {
              const entry = ensureEntry(state, key);
              entry.visible = visible;
            },
            false,
            `dialog/setVisible/${key}`,
          ),

        setDialogContent: (key, content) =>
          set(
            (state) => {
              const entry = ensureEntry(state, key);
              entry.contentMain = content;
            },
            false,
            `dialog/setContent/${key}`,
          ),

        getDialogEntry: (key) => get().dialogs[key],
      })),
    ),
    { name: "dialogStore", store: "dialogStore" },
  ),
);
