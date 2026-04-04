import {Box, Card, CardContent, Typography} from '@mui/material';

interface HealthStripProps {
  server: 'ok' | 'degraded';
  meili: 'ok' | 'unreachable';
}

function StatusDot({status}: {status: 'ok' | 'degraded' | 'unreachable'}) {
  const color = status === 'ok' ? 'success.main' : 'error.main';
  return (
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
      }}
    />
  );
}

export function HealthStrip({server, meili}: HealthStripProps) {
  return (
    <Card>
      <CardContent sx={{display: 'flex', gap: 4, alignItems: 'center', py: 1.5, '&:last-child': {pb: 1.5}}}>
        <Typography variant="overline" color="text.secondary" sx={{mr: 1}}>
          System Health
        </Typography>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <StatusDot status={server} />
          <Typography variant="body2">Server: {server}</Typography>
        </Box>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
          <StatusDot status={meili} />
          <Typography variant="body2">Meilisearch: {meili}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
