import React from 'react';
export default function GlobalDecorator({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLight = true; // 或者从 env/config/localStorage 判断
  return (
    <div
      style={{
        backgroundColor: isLight ? '#ffffff' : '#121212',
        color: isLight ? '#000000' : '#ffffff',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  );
}
