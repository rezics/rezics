import React, {useEffect, useState} from 'react';
import {Button, type ButtonProps} from '@mui/material';

interface CooldownButtonProps extends ButtonProps {
  cooldownMs: number; // 冷却时间，单位 ms，比如 5000 = 5 秒
  onCooldownClick?: () => void; // 可选：在冷却时点击的回调（比如提示“别急”）
}

export const CooldownButton: React.FC<CooldownButtonProps> = ({
  cooldownMs,
  onClick,
  onCooldownClick,
  children,
  disabled,
  ...rest
}) => {
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // 每 200ms 刷新一次当前时间，用来计算是否在冷却期
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 200);

    return () => clearInterval(timer);
  }, []);

  const inCooldown = cooldownUntil != null && now < cooldownUntil;

  const remainingMs = inCooldown ? cooldownUntil! - now : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = e => {
    if (inCooldown) {
      // 冷却期内点击（如果你想完全无反应，可以去掉这个分支）
      onCooldownClick?.();
      return;
    }

    // 正常点击
    if (onClick) {
      onClick(e);
    }

    // 进入冷却
    setCooldownUntil(Date.now() + cooldownMs);
  };

  return (
    <Button
      {...rest}
      disabled={disabled || inCooldown} // 外部 disabled 优先
      onClick={handleClick}
    >
      {inCooldown ? (
        <>
          {children}（{remainingSec}s）
        </>
      ) : (
        children
      )}
    </Button>
  );
};
