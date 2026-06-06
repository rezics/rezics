import type { AdminStatsResponse } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["admin"]);
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const primary = readCssVar("--colors-brand-fill", "#DB515C");
  const secondary = readCssVar("--colors-chart-2", "#1a73e8");
  const fg = readCssVar(
    "--colors-text-primary",
    isDark ? "#f5f5f5" : "#111111",
  );
  const fgMuted = readCssVar(
    "--colors-text-secondary",
    isDark ? "#b6b6b6" : "#5f6368",
  );

  const data = useMemo(
    () => ({
      labels: trend.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: t("admin:nav_books"),
          data: trend.map((d) => d.books),
          backgroundColor: primary,
        },
        {
          label: t("admin:dashboard_comments"),
          data: trend.map((d) => d.comments),
          backgroundColor: secondary,
        },
      ],
    }),
    [trend, primary, secondary, t],
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
