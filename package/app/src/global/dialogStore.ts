import { create } from 'zustand'

interface DialogState {
  dialogVisible: boolean
  setDialogVisible: (visible: boolean) => void
}

const store = create<DialogState>((set) => ({
  dialogVisible: false,
  setDialogVisible: (visible) => set({ dialogVisible: visible }),
}))

export const dialogStore = store
export const useDialogStore = () => store.getState() 