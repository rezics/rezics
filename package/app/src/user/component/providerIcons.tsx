import {
  IconBrandGithub,
  IconBrandGoogle,
  IconBrandTelegram,
  IconBrandWindows,
  IconBrandX,
} from '@tabler/icons-react';
import type {AuthProvider} from '@package/contract';
import type {ComponentType} from 'react';

type IconProps = {size?: number; className?: string};

// TODO: replace with proper branded/colored SVG icons
export const providerIcons: Record<AuthProvider['id'], ComponentType<IconProps>> = {
  google: IconBrandGoogle,
  github: IconBrandGithub,
  microsoft: IconBrandWindows,
  telegram: IconBrandTelegram,
  twitter: IconBrandX,
};
