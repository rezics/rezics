import React from 'react';
import {AppShell} from '@rezics/app-shell';
export default function GlobalDecorator({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
