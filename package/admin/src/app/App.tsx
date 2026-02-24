import 'github-markdown-css/github-markdown-light.css';
import {AppShell} from '@package/app-shell/foundation';
import {AuthProvider} from './provider/AuthProvider';
import {WindowAlert} from '@package/app-shell/foundation';
import {RouterProvider} from '@tanstack/react-router';
import {router} from '@/router';

export default function App() {
  return (
    <AppShell
      features={
        <>
          <AuthProvider />
          <WindowAlert />
        </>
      }
    >
      <RouterProvider router={router} />
    </AppShell>
  );
}
