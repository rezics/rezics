import {create} from 'zustand';

interface AlertState {
  open: boolean;
  message: string;
  show: (message: string) => void;
  close: () => void;
}

export const useAlertStore = create<AlertState>((set, _get) => ({
  open: false,
  message: '',

  show: message => set({open: true, message}),

  close: () => set({open: false, message: ''}),
}));
