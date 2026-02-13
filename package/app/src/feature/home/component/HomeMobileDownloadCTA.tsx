import React from 'react';
import {Button, Typography} from '@mui/material';

export const HomeMobileDownloadCTA: React.FC = () => {
  return (
    <div className="w-full rounded border p-4 flex items-center justify-between bg-gray-50">
      <div>
        <Typography variant="subtitle1" className="mb-1">
          下载移动 App
        </Typography>
        <Typography variant="body2" color="text.secondary">
          随时随地看书、写评、管理书单
        </Typography>
      </div>
      <div className="flex gap-2">
        <Button variant="contained" color="primary">
          App Store
        </Button>
        <Button variant="outlined" color="primary">
          Google Play
        </Button>
      </div>
    </div>
  );
};

export default HomeMobileDownloadCTA;

