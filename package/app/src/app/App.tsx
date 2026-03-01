import 'github-markdown-css/github-markdown-light.css';
import {AppShell} from '@package/app-shell';
import {AuthProvider} from './provider/AuthProvider';
import {WindowAlert} from '@package/app-shell';
import {RouterProvider} from '@tanstack/react-router';
import {router} from '@/router';

export default function App() {
  console.log(import.meta.env);
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
