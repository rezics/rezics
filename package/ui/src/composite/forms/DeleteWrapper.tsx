import { Button, type ButtonProps } from "@mui/material";
import React, { useState } from "react";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

export interface DeleteWrapperProps {
  /** 点击确认后执行的删除逻辑 */
  onDelete: () => Promise<unknown> | unknown;
  /** 触发删除的任意元素（按钮、图标等） */
  children: React.ReactElement<any>;
  /** 是否禁用删除入口 */
  disabled?: boolean;
}

/**
 * 通用删除确认包装组件。
 * - 可以包裹任意可点击元素；
 * - 点击后弹出确认删除 Dialog；
 * - 确认后执行传入的删除函数。
 */
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

    // 保留子元素原有 onClick 行为
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

export interface DeleteButtonProps
  extends Omit<ButtonProps, "onClick" | "children"> {
  /** 点击确认后执行的删除逻辑 */
  onDelete: () => Promise<unknown> | unknown;
  /** 按钮文案，默认“删除” */
  label?: React.ReactNode;
  variant?: "contained" | "outlined";
}

/**
 * 自带确认弹窗的删除按钮。
 * 使用示例：
 * ```tsx
 * <DeleteButton onDelete={handleDelete} color="error" />
 * ```
 */
export const DeleteButton: React.FC<DeleteButtonProps> = ({
  onDelete,
  label = "删除",
  disabled,
  variant = "outlined",
  ...buttonProps
}) => {
  return (
    <DeleteWrapper onDelete={onDelete} disabled={disabled}>
      <Button variant={variant} {...buttonProps} disabled={disabled}>
        {label}
      </Button>
    </DeleteWrapper>
  );
};

export default DeleteWrapper;
