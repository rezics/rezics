import {useUserStore} from '@/global/userStore.ts';
import {Button, Typography} from '@mui/material';

export function TestPage02() {
  const user = useUserStore(state => state.user);
  const product = {
    title: 'Product 1',
    lorem: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    cover: 'https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg',
  };
  return (
    <div className="w-[300px]">
      <h1>Test Page 02</h1>
      <div
        className="relative w-full h-[250px] sm:h-[280px] rounded-lg overflow-hidden flex items-end"
        style={{
          backgroundImage: `url(${product.cover ?? ''})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* 暗幕遮罩，向上渐变 → 更读得清 */}

        {/* 内容层 */}
        <div className="relative z-10 w-full space-y-1 text-white p-3 sm:p-6 ">
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent mb-0" />
          <Typography variant="caption" className="line-clamp-2 opacity-90">
            <div>{product.title}</div>
            {product.lorem}
          </Typography>
        </div>
      </div>
    </div>
  );
}
