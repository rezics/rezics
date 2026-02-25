import React from 'react';
import {AppShell} from '@package/app-shell';
export default function GlobalDecorator({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
