import { create } from "zustand";

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

const useDialogStore = create<DialogState>((set, get) => ({
  dialogs: {},

  setDialogVisible: (key, visible) => {
    const current = get().dialogs[key] ?? {
      visible: false,
      contentMain: "",
    };
    set({
      dialogs: {
        ...get().dialogs,
        [key]: { ...current, visible },
      },
    });
  },

  setDialogContent: (key, content) => {
    const current = get().dialogs[key] ?? {
      visible: false,
      contentMain: "",
    };
    set({
      dialogs: {
        ...get().dialogs,
        [key]: { ...current, contentMain: content },
      },
    });
  },

  getDialogEntry: (key) => get().dialogs[key],
}));

export { useDialogStore };
