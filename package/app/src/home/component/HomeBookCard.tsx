import {Link} from '@package/ui/primitive/link/Link.tsx';
import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import type {BookDTO} from '@package/contract';
import {LazyLoadImage} from '@package/ui/primitive/image/LazyLoadImage.tsx';
import {useTranslation} from 'react-i18next';
// 辅助组件或直接在父组件中使用
const BookCard = ({
  book,
  className = '',
}: {
  book: BookDTO;
  className?: string;
}) => {
  const {t} = useTranslation();
  return (
    <Card
      key={book.unitId}
      className={`flex flex-col rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${className}`}
      elevation={1} // 初始阴影层级
    >
      {/* CardActionArea 是 MUI 提供的专用组件，
        它会自动处理涟漪效果（Ripple）并将整个区域设为可点击。
        通过 component={Link} 将其转换为路由链接。
      */}
      <CardActionArea
        component={Link}
        to={`/book/${book.unitId}`}
        className="flex flex-col items-stretch justify-start"
      >
        {/* 封面图区域 */}
        {book.coverUrl ? (
          <Box className="relative w-full h-42 aspect-[3/4] overflow-hidden bg-gray-100">
            <LazyLoadImage
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
            {/* 可选：添加一个渐变遮罩在底部，让文字在图片衔接处更柔和（视设计风格而定） */}
            {/* <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" /> */}
          </Box>
        ) : (
          // 无图片时的占位符
          <Box className="w-full aspect-[3/4] h-42 bg-gray-200 flex items-center justify-center text-gray-400">
            {t('book.no_cover')}
          </Box>
        )}

        {/* 内容区域 */}
        <CardContent className="flex flex-col flex-1 w-full gap-1 p-1">
          {/* 标题：限制显示2行，超出省略 */}
          <div
            className="font-bold leading-tight line-clamp-2 min-h-[2.5em]"
            title={book.title}
          >
            {book.title}
          </div>

          {/* 作者：限制显示1行，放在底部 */}
          <Typography
            variant="caption"
            component="p"
            className="text-gray-500 truncate mt-auto pt-1"
          >
            {book.author?.[0]?.name || t('book.unknown_author')}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default BookCard;
