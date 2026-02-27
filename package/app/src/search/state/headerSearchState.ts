import {create} from 'zustand';

type HeaderSearchState = {
  mobileExpanded: boolean;
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
  toggleMobileSearch: () => void;
};

export const useHeaderSearchState = create<HeaderSearchState>()(set => ({
  mobileExpanded: false,
  openMobileSearch: () => set({mobileExpanded: true}),
  closeMobileSearch: () => set({mobileExpanded: false}),
  toggleMobileSearch: () =>
    set(state => ({mobileExpanded: !state.mobileExpanded})),
}));
