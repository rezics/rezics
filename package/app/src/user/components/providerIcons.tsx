import type { AuthProvider } from "@rezics/contract";
import {
  GithubIcon,
  GoogleIcon,
  MicrosoftIcon,
  TelegramIcon,
  XIcon,
} from "@rezics/icons";
import type { ComponentType } from "react";

type IconProps = { size?: number; className?: string };

// TODO: replace with proper branded/colored SVG icons
export const providerIcons: Record<
  AuthProvider["id"],
  ComponentType<IconProps>
> = {
  google: GoogleIcon,
  github: GithubIcon,
  microsoft: MicrosoftIcon,
  telegram: TelegramIcon,
  twitter: XIcon,
};
