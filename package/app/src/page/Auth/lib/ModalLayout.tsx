import {Typography} from '@mui/material';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import type {FC} from 'react';
import type React from 'react';

export const ModalLayout: FC<{
  title: string;
  content: React.ReactNode;
  actions: React.ReactNode;
}> = ({title, content, actions}) => (
  <form>
    <Card className="min-w-96 max-w-md">
      <CardContent className="flex flex-col gap-4">
        <Typography variant="h4">{title}</Typography>
        {content}
      </CardContent>
      <CardActions className="flex flex-row justify-between">
        {actions}
      </CardActions>
    </Card>
  </form>
);
