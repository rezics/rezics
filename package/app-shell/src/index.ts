export {AppShell, type AppShellProps} from './AppShell';

export {useAppStore} from './state/appStore';
export {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
  type AuthCapabilityLevel,
  type AuthSessionHydrationStatus,
  type AuthSessionStoreState,
} from './state/authSessionStore';
export {useAlertStore} from './state/windowAlertStore';

export {AuthProvider, type AuthProviderProps} from './provider/AuthProvider';
export {ReactQueryProvider} from './provider/ReactQueryProvider';
export {PersistentSettingsLoader} from './provider/PersistentSettingsLoader';
export {qc} from './provider/reactQueryUtil';

export {useAppInit} from './hook/useAppInit';

export {WindowAlert} from './component/WindowAlert';

export {getTheme, getDynamicTheme} from './config/theme';
export {
  generateDynamicColors,
  applyDynamicThemeToDOM,
  dynamicColorsToPalette,
  extractColorFromImage,
  PRESET_COLORS,
  type DynamicColorScheme,
} from './config/dynamicTheme';
