import React, {useState} from 'react';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import {LangToggle} from '../LangToggle';
import LanguageIcon from '@mui/icons-material/Language';
import {useTranslation} from 'react-i18next';
import {ThemeToggler} from './ThemeToggler';
import {useIsMobile} from '@/shared/util/use-media-query';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export function MoreHorizMenu({children, className}: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const {t} = useTranslation();
  const open = Boolean(anchorEl);
  const isMobile = useIsMobile();

  return (
    <>
      <IconButton
        onClick={e => setAnchorEl(e.currentTarget)}
        edge={isMobile ? false : 'end'}
        className={className}
        sx={{
          ml: 2,
        }}
      >
        <MoreHorizIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <LangToggle>
          {({onClick}) => (
            <MenuItem onClick={onClick}>
              <ListItemIcon>
                <LanguageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('layout.header.toggle_language')}</ListItemText>
            </MenuItem>
          )}
        </LangToggle>
        <ThemeToggler />
        {/* <MenuItem>
          <ThemeQuickToggle />
        </MenuItem> */}
        {children}
      </Menu>
    </>
  );
}
