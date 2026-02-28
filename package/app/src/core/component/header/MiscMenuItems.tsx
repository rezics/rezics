import {LangToggle} from '../LangToggle';
import LanguageIcon from '@mui/icons-material/Language';
import {ThemeToggler} from './ThemeToggler';
import {useTranslation} from 'react-i18next';
import {MenuItem, ListItemIcon, ListItemText} from '@mui/material';

export function MiscMenuItems() {
  const {t} = useTranslation();
  return (
    <>
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
    </>
  );
}
