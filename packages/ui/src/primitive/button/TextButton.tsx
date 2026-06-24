import type React from "react";

export interface TextButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  buttonStyle?: "text" | "link";
}

export const TextButton = ({
  children,
  onClick,
  buttonStyle = "link",
}: TextButtonProps) => {
  const buttonClassName = buttonStyle === "link" ? "cursor-pointer" : "";
  const colorClassName =
    buttonStyle === "link" ? "text-link hover:underline" : "text-text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${colorClassName} ${buttonClassName}`}
    >
      {children}
    </button>
  );
};
