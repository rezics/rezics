import { ArrowLeft, FileText } from "lucide-react";
import type {
  EditConsoleLayoutProps,
  EditConsoleNavigationItem,
} from "./EditConsoleLayout";

export type MinimalEditConsoleConfigOptions = {
  returnLabel: string;
  returnHref: string;
  editorLabel?: string;
  editorHref?: string;
};

export function createMinimalEditConsoleConfig({
  returnLabel,
  returnHref,
  editorLabel,
  editorHref,
}: MinimalEditConsoleConfigOptions): Pick<
  EditConsoleLayoutProps,
  "returnItem" | "primaryItems"
> {
  const primaryItems: EditConsoleNavigationItem[] =
    editorLabel && editorHref
      ? [
          {
            label: editorLabel,
            href: editorHref,
            icon: FileText,
          },
        ]
      : [];

  return {
    returnItem: {
      label: returnLabel,
      href: returnHref,
      icon: ArrowLeft,
    },
    primaryItems,
  };
}
