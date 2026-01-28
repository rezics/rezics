import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import { Box, styled, Typography } from '@mui/material';
import React from 'react';
import { Link } from '@package/ui/Navigation/Link.tsx';

const LinkWithIcon = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  cursor: 'pointer',
  color: theme.palette.text.primary,
  transition: 'color var(--default-transition-duration) var(--ease-out)',
  '& .arrow-icon': {
    fontWeight: 900,
    marginLeft: '0.125rem',
    lineHeight: '1',
    fontSize: '24px', // 让 size 从 props 控制
    color: 'var(--color-on-base)',
    transition:
      'color var(--default-transition-duration) var(--ease-out), transform var(--default-transition-duration) var(--ease-out)',
  },
  '&:hover .arrow-icon': {
    color: theme.palette.primary.main,
    transform: 'scale(1.1)',
  },
}));

export type Show = {
  size?: number;
  color?: string;
  children?: React.ReactNode;
  to?: string;
};

export const ArrowForwardIconShow: React.FC<Show> = ({ children, to }) => {
  return (
    <Link to={to || '/'}>
      <LinkWithIcon>
        {/* 文本部分，用 Typography 能保证行高一致 */}
        <Typography component="span">{children}</Typography>
        {/* 图标部分，初始继承父级 text color */}
        <ArrowForwardIosRoundedIcon className="arrow-icon transform !text-base" />
      </LinkWithIcon>
    </Link>
  );
};

export type Container = Show;
export const ArrowForwardIconContainer: React.FC<Container> = props => {
  return <ArrowForwardIconShow {...props} />;
};
