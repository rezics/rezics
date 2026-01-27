import {Place} from '@mui/icons-material';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import React from 'react';
import {useNavigate, useRouterState} from '@tanstack/react-router';

export type NotFoundShowProps = {
  path: string;
  onBack: () => void;
  onHome: () => void;
};

export const NotFoundShow: React.FC<NotFoundShowProps> = ({
  path,
  onBack,
  onHome,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="min-w-md max-w-lg">
        <CardContent className="flex flex-col gap-4">
          <Typography variant="h4">Not Found</Typography>
          <div>
            <Place /> {path}
          </div>
        </CardContent>
        <CardActions className="flex flex-row justify-between">
          <Button onClick={onBack}>Back</Button>
          <Button onClick={onHome}>Home</Button>
        </CardActions>
      </Card>
    </div>
  );
};

export type NotFoundContainerProps = object;

export const NotFoundContainer: React.FC<NotFoundContainerProps> = () => {
  const navigate = useNavigate();
  const path = useRouterState({
    select: s => `${s.location.pathname}${s.location.search ?? ''}`,
  });

  const handleBack = () => {
    window.history.back();
  };

  const handleHome = () => {
    navigate({to: '/'});
  };

  return <NotFoundShow path={path} onBack={handleBack} onHome={handleHome} />;
};
