import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "#/shadcn/button";

type ButtonProps = React.ComponentProps<typeof Button>;

interface CooldownButtonProps extends ButtonProps {
  cooldownMs: number; // Cooldown duration in ms, e.g. 5000 = 5 seconds — 冷却时间，单位 ms，比如 5000 = 5 秒
  onCooldownClick?: () => void; // Optional: callback fired when clicked during cooldown (e.g. a "hold on" hint) — 可选：在冷却时点击的回调（比如提示“别急”）
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

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 200);

    return () => clearInterval(timer);
  }, []);

  const inCooldown = cooldownUntil != null && now < cooldownUntil;

  const remainingMs = inCooldown ? cooldownUntil! - now : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (inCooldown) {
      onCooldownClick?.();
      return;
    }

    if (onClick) {
      onClick(e as Parameters<NonNullable<typeof onClick>>[0]);
    }

    setCooldownUntil(Date.now() + cooldownMs);
  };

  return (
    <Button {...rest} disabled={disabled || inCooldown} onClick={handleClick}>
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
