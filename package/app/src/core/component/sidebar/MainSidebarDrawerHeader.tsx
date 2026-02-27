import {useTheme} from '@mui/material';
import {Box, IconButton} from '@mui/material';
import {ChevronLeft, ChevronRight} from '@mui/icons-material';

export function MainSidebarDrawerHeader({
  handleDrawerToggle,
}: {
  handleDrawerToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 1,
        ...theme.mixins.toolbar, // ensures space below AppBar
        justifyContent: 'flex-end',
      }}
    >
      <IconButton onClick={handleDrawerToggle}>
        {theme.direction === 'ltr' ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>
    </Box>
  );
}
