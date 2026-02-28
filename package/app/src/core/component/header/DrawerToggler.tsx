import {IconButton} from '@mui/material';
import {Menu} from '@mui/icons-material';
import {useTranslation} from 'react-i18next';

interface DrawerTogglerProps {
  handleDrawerToggleInner: () => void;
  layoutType: 'type-a' | 'type-b';
  sidebarOpen: boolean;
}

export const DrawerToggler = ({
  handleDrawerToggleInner,
  layoutType,
  sidebarOpen,
}: DrawerTogglerProps) => {
  const {t} = useTranslation();
  return (
    <IconButton
      aria-label={t('accessibility.open_drawer')}
      onClick={handleDrawerToggleInner}
      sx={{
        mr: 2,
        ml: 1,
        display:
          layoutType == 'type-b' ? 'flex' : sidebarOpen ? 'none' : 'flex',
      }}
    >
      <Menu />
    </IconButton>
  );
};
