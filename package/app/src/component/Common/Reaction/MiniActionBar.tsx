import {IconButton, Tooltip} from '@mui/material';

import {Add, Comment, Edit, FavoriteBorder} from '@mui/icons-material';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'wouter';

import {useUserStore} from '@/global/userStore';

interface MiniAdminActionBarProps {
  editionURL: string;
  textColor?: string;
  userUnitId?: string;
}

export function MiniAdminActionBar({
  editionURL,
  textColor,
  userUnitId,
}: MiniAdminActionBarProps) {
  const {t} = useTranslation();
  const user = useUserStore(state => state.user);
  const isAdmin = user?.permission?.role.includes('ADMIN');
  const isOwner = user?.unitId === userUnitId;
  const [_location, navigate] = useLocation();

  if (!isAdmin && !isOwner) {
    return null;
  }
  return (
    <span>
      <Tooltip title={t('common.edit')} placement="top">
        <IconButton
          aria-label={t('common.edit')}
          size="small"
          onClick={() => {
            navigate(editionURL);
          }}
        >
          <Edit fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
    </span>
  );
}

interface MiniActionBarProps {
  hideReply?: boolean;
  className?: string;
  textColor?: string;
  handleOnCommentClick?: () => void;
}

export function MiniActionBar({
  hideReply = false,
  className,
  textColor,
  handleOnCommentClick,
}: MiniActionBarProps) {
  const {t} = useTranslation();
  // const [_location, navigate] = useLocation();
  return (
    <span className={className}>
      <Tooltip title={t('accessibility.favorite')} placement="top">
        <IconButton aria-label={t('accessibility.favorite')} size="small">
          <FavoriteBorder fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
      {!hideReply && (
        <Tooltip title={t('accessibility.comments')} placement="top">
          <IconButton
            aria-label={t('accessibility.comments')}
            size="small"
            onClick={handleOnCommentClick ?? undefined}
          >
            <Comment fontSize="small" className={textColor} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={t('accessibility.collection')} placement="top">
        <IconButton aria-label={t('accessibility.collection')} size="small">
          <Add fontSize="small" className={textColor} />
        </IconButton>
      </Tooltip>
    </span>
  );
}
