import * as m from "@rezics/i18n/messages";
import type { AdminStatsResponse } from "@rezics/contract";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ContentTrendChartProps {
  trend: AdminStatsResponse["contentTrend"];
}

/**
 * Read a CSS custom property from the root, with a sensible fallback for SSR or
 * if the variable is missing.
 */
function readCssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function ContentTrendChart({ trend }: ContentTrendChartProps) {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const primary = readCssVar("--rezics-sys-color-primary", "#f4606c");
  const secondary = readCssVar("--rezics-sys-color-tertiary", "#9aa0a6");
  const fg = readCssVar(
    "--rezics-sys-color-text-primary",
    isDark ? "#f5f5f5" : "#1a1a1a",
  );
  const fgMuted = readCssVar(
    "--rezics-sys-color-text-secondary",
    isDark ? "#aaaaaa" : "#666666",
  );

  const data = useMemo(
    () => ({
      labels: trend.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: m.admin_nav_books(),
          data: trend.map((d) => d.books),
          backgroundColor: primary,
        },
        {
          label: m.admin_dashboard_comments(),
          data: trend.map((d) => d.comments),
          backgroundColor: secondary,
        },
      ],
    }),
    [trend, primary, secondary],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: { color: fg },
        },
      },
      scales: {
        x: {
          ticks: { color: fgMuted, maxRotation: 45 },
          grid: {
            color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
          },
        },
        y: {
          beginAtZero: true,
          ticks: { color: fgMuted },
          grid: {
            color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
          },
        },
      },
    }),
    [fg, fgMuted, isDark],
  );

  return <Bar data={data} options={options} />;
}
