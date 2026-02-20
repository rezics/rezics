import React, {useEffect} from 'react';
import {useAlertStore} from '../state/windowAlertStore';
import {Alert} from '@mui/material';
import clsx from 'clsx';

export const WindowAlert: React.FC = () => {
  const {open, message} = useAlertStore();

  // 自动关闭
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      useAlertStore.getState().close();
    }, 2500);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;
  return (
    <div
      className={clsx(
        'fixed left-1/2 -translate-x-1/2 top-0 z-[9999] transition-transform duration-300',
        open ? 'translate-y-3' : '-translate-y-full',
      )}
    >
      <Alert
        severity="info"
        variant="standard"
        className="shadow-lg"
        sx={{minWidth: '280px'}}
      >
        {message}
      </Alert>
    </div>
  );
};
