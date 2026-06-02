import React, { useState } from "react";
import { Button } from "#/shadcn/button";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

export interface DeleteWrapperProps {
  onDelete: () => Promise<unknown> | unknown;
  children: React.ReactElement<any>;
  disabled?: boolean;
}

export const DeleteWrapper: React.FC<DeleteWrapperProps> = ({
  children,
  onDelete,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleTriggerClick: React.MouseEventHandler<any> = (event) => {
    if (disabled) return;

    const originalOnClick = (children.props as any).onClick as
      | React.MouseEventHandler<any>
      | undefined;

    if (originalOnClick) {
      originalOnClick(event);
    }

    if (event.defaultPrevented) return;

    setOpen(true);
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
  };

  const handleConfirm = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await onDelete();
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const trigger = React.cloneElement(children, {
    onClick: handleTriggerClick,
    ...(disabled !== undefined ? { disabled } : {}),
  } as any);

  return (
    <>
      {trigger}
      <ConfirmDeleteDialog
        open={open}
        onClose={handleClose}
        onSubmit={handleConfirm}
      />
    </>
  );
};

export interface DeleteButtonProps {
  onDelete: () => Promise<unknown> | unknown;
  label?: React.ReactNode;
  variant?: "default" | "outline" | "destructive" | "ghost";
  size?:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg";
  disabled?: boolean;
  className?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({
  onDelete,
  label = "删除",
  disabled,
  variant = "destructive",
  size = "default",
  className,
}) => {
  return (
    <DeleteWrapper onDelete={onDelete} disabled={disabled}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled}
        className={className}
      >
        {label}
      </Button>
    </DeleteWrapper>
  );
};

export default DeleteWrapper;
