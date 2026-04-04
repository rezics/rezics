import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import {useMemo} from 'react';
import {Bar} from 'react-chartjs-2';
import {useTheme} from '@mui/material';
import type {AdminStatsResponse} from '@rezics/contract';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ContentTrendChartProps {
  trend: AdminStatsResponse['contentTrend'];
}

export function ContentTrendChart({trend}: ContentTrendChartProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const data = useMemo(
    () => ({
      labels: trend.map((d) => d.date.slice(5)),
      datasets: [
        {
          label: 'Books',
          data: trend.map((d) => d.books),
          backgroundColor: theme.palette.primary.main,
        },
        {
          label: 'Comments',
          data: trend.map((d) => d.comments),
          backgroundColor: theme.palette.secondary.main,
        },
      ],
    }),
    [trend, theme],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {color: theme.palette.text.primary},
        },
      },
      scales: {
        x: {
          ticks: {color: theme.palette.text.secondary, maxRotation: 45},
          grid: {color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'},
        },
        y: {
          beginAtZero: true,
          ticks: {color: theme.palette.text.secondary},
          grid: {color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'},
        },
      },
    }),
    [theme, isDark],
  );

  return <Bar data={data} options={options} />;
}
