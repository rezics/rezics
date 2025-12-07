import React from 'react';

export interface TextButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  buttonStyle?: 'text' | 'link';
}

export const TextButton = ({
  children,
  onClick,
  buttonStyle = 'link',
}: TextButtonProps) => {
  const buttonClassName = buttonStyle === 'link' ? 'cursor-pointer' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[var(--mui-palette-primary-main)] ${buttonClassName}`}
    >
      {children}
    </button>
  );
};
