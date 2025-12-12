import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import LanguageIcon from '@mui/icons-material/Language';
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';

export const LangToggle: React.FC = () => {
  const {i18n} = useTranslation();

  const changeLang = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
    console.log('set lang to ', lang);
  };

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  function handleChangeLang(lang: string) {
    handleClose();
    changeLang(lang);
  }

  return (
    <>
      <Tooltip title="语言切换">
        <IconButton onClick={handleClick}>
          <LanguageIcon className="text-white" />
        </IconButton>
      </Tooltip>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          list: {
            'aria-labelledby': 'basic-button',
          },
        }}
        transformOrigin={{horizontal: 'center', vertical: 'top'}}
        anchorOrigin={{horizontal: 'center', vertical: 'bottom'}}
      >
        <MenuItem onClick={() => handleChangeLang('zh-CN')}>
          <ListItemText>简体中文</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang('zh-TW')}>
          <ListItemText>繁体中文</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang('en-US')}>
          <ListItemText>English</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang('ja-JP')}>
          <ListItemText>日本語</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleChangeLang('de-DE')}>
          <ListItemText>Deutsch</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};
