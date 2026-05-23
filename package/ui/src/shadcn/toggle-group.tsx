import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import * as React from "react";
import type { VariantProps } from "class-variance-authority";

import { cn } from "#/shared/lib/utils";
import { toggleVariants } from "#/shadcn/toggle";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
  orientation: "horizontal",
});

type ToggleGroupBaseProps = Omit<
  ToggleGroupPrimitive.Props,
  "defaultValue" | "onValueChange" | "value"
>;

type ToggleGroupSingleProps = {
  defaultValue?: string;
  onValueChange?: (
    value: string,
    eventDetails: Parameters<
      NonNullable<ToggleGroupPrimitive.Props["onValueChange"]>
    >[1],
  ) => void;
  type?: "single";
  value?: string;
};

type ToggleGroupMultipleProps = {
  defaultValue?: string[];
  onValueChange?: ToggleGroupPrimitive.Props["onValueChange"];
  type: "multiple";
  value?: string[];
};

type ToggleGroupProps = ToggleGroupBaseProps &
  VariantProps<typeof toggleVariants> & {
    spacing?: number;
    orientation?: "horizontal" | "vertical";
  } & (ToggleGroupSingleProps | ToggleGroupMultipleProps);

function ToggleGroup({
  className,
  defaultValue,
  onValueChange,
  type = "single",
  value,
  variant,
  size,
  spacing = 0,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupProps) {
  const primitiveValue: ToggleGroupPrimitive.Props["value"] =
    type === "single"
      ? typeof value === "string"
        ? [value]
        : undefined
      : (value as string[] | undefined);
  const primitiveDefaultValue: ToggleGroupPrimitive.Props["defaultValue"] =
    type === "single"
      ? typeof defaultValue === "string"
        ? [defaultValue]
        : undefined
      : (defaultValue as string[] | undefined);

  const handleValueChange: ToggleGroupPrimitive.Props["onValueChange"] = (
    groupValue,
    eventDetails,
  ) => {
    if (type === "single") {
      (onValueChange as ToggleGroupSingleProps["onValueChange"])?.(
        groupValue.at(-1) ?? "",
        eventDetails,
      );
      return;
    }
    (onValueChange as ToggleGroupMultipleProps["onValueChange"])?.(
      groupValue,
      eventDetails,
    );
  };

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      defaultValue={primitiveDefaultValue}
      value={primitiveValue}
      onValueChange={handleValueChange}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[spacing='0']:data-[variant=outline]:rounded-3xl data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 group-data-[spacing='0']/toggle-group:rounded-none group-data-[spacing='0']/toggle-group:px-3 group-data-[spacing='0']/toggle-group:shadow-none focus:z-10 focus-visible:z-10 group-data-[spacing='0']/toggle-group:has-data-[icon=inline-end]:pr-2.5 group-data-[spacing='0']/toggle-group:has-data-[icon=inline-start]:pl-2.5 group-data-[orientation=horizontal]/toggle-group:data-[spacing='0']:first:rounded-l-3xl group-data-[orientation=vertical]/toggle-group:data-[spacing='0']:first:rounded-t-3xl group-data-[orientation=horizontal]/toggle-group:data-[spacing='0']:last:rounded-r-3xl group-data-[orientation=vertical]/toggle-group:data-[spacing='0']:last:rounded-b-3xl data-[state=on]:bg-muted group-data-[orientation=horizontal]/toggle-group:data-[spacing='0']:data-[variant=outline]:border-l-0 group-data-[orientation=vertical]/toggle-group:data-[spacing='0']:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing='0']:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[spacing='0']:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
