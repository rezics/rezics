import { Divider, Typography } from '@mui/material';
import type { FC, ReactNode } from 'react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  divider?: boolean;
}

export const SettingsSection: FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  divider = true,
}) => (
  <>
    <section className="py-6">
      <Typography variant="h6" className="font-semibold mb-1">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" className="mb-4">
          {description}
        </Typography>
      )}
      <div className="mt-4">{children}</div>
    </section>
    {divider && <Divider />}
  </>
);
