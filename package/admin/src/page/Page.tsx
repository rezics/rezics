import {Box, Container, Typography} from '@mui/material';
import React from 'react';

export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Container maxWidth="lg" disableGutters>
      <Box
        sx={{
          display: 'flex',
          alignItems: {xs: 'flex-start', sm: 'center'},
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: {xs: 'column', sm: 'row'},
          mb: 2,
        }}
      >
        <Box sx={{minWidth: 0}}>
          <Typography variant="h5" fontWeight={800}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
              {description}
            </Typography>
          ) : null}
        </Box>
        {actions ? <Box sx={{flexShrink: 0}}>{actions}</Box> : null}
      </Box>
      {children}
    </Container>
  );
}

