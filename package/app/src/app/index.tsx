import {createRoot} from 'react-dom/client';
import './index.css';

import 'virtual:uno.css';

import App from './App.tsx';
import {initI18n} from './provider/i18n.ts';
// import { setupMock } from "./plugin/providers/mock.ts";

// 初始化（这类副作用放入口即可，不参与热替换）
initI18n();

const container = document.getElementById('app') as HTMLElement;

// 直接创建 root；Vite/React Refresh 会在 HMR 时优雅处理
const root = createRoot(container);

// setupMock().then(() => {
//   root.render(<App />);
// });

root.render(<App />);

// 如果要在某些环境防止重复创建，也可以：
// (globalThis as any).__APP_ROOT ??= createRoot(container);
// (globalThis as any).__APP_ROOT.render(<App />);
