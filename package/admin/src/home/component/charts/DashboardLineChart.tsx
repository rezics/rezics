import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import React from 'react';
import {Line} from 'react-chartjs-2';
import {useTheme} from '@mui/material';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

export function DashboardLineChart() {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;

  const data = React.useMemo(
    () => ({
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Visits',
          data: [120, 180, 160, 240, 210, 260, 300],
          borderColor: primaryColor,
          backgroundColor: `${primaryColor}15`,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
        },
      ],
    }),
    [],
  );

  const options = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {display: true, position: 'top' as const},
      },
      scales: {
        y: {beginAtZero: true},
      },
    }),
    [],
  );

  return <Line data={data} options={options} />;
}
