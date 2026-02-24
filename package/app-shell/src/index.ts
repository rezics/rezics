export {AppShell, type AppShellProps} from './AppShell';

export {useAppStore} from './state/appStore';
export {useAlertStore} from './state/windowAlertStore';

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
