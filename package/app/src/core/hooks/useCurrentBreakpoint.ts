import { useEffect, useState } from "react";

type Breakpoint = "xs" | "xsm" | "sm" | "md" | "lg" | "xl";

const breakpoints = {
  xs: 0,
  xsm: 450,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export function useCurrentBreakpoint(): Breakpoint {
  const getBreakpoint = (): Breakpoint => {
    const width = window.innerWidth;

    if (width >= breakpoints.xl) return "xl";
    if (width >= breakpoints.lg) return "lg";
    if (width >= breakpoints.md) return "md";
    if (width >= breakpoints.sm) return "sm";
    if (width >= breakpoints.xsm) return "xsm";
    return "xs";
  };

  const [bp, setBp] = useState<Breakpoint>(getBreakpoint());

  useEffect(() => {
    const handleResize = () => {
      setBp(getBreakpoint());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getBreakpoint]);

  return bp;
}
