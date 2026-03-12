import {
  GithubIcon,
  GoogleIcon,
  TelegramIcon,
  XIcon,
  MicrosoftIcon,
} from '@rezics/icons';
import type {AuthProvider} from '@package/contract';
import type {ComponentType} from 'react';

type IconProps = {size?: number; className?: string};

// TODO: replace with proper branded/colored SVG icons
export const providerIcons: Record<
  AuthProvider['id'],
  ComponentType<IconProps>
> = {
  google: GoogleIcon,
  github: GithubIcon,
  microsoft: MicrosoftIcon,
  telegram: TelegramIcon,
  twitter: XIcon,
};
