import {Box, Grid, Typography} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {Autoplay, Pagination} from 'swiper/modules';
import {Swiper, SwiperSlide} from 'swiper/react';
import {useQuery} from '@tanstack/react-query';
import {echoKvGetQuery} from '@/api/echokv/echokv';
import {parseEchoKVResponse} from '@/api/echokv/util';
import {useAlertStore} from '@/global/windowAlertStore';
import {Link} from 'wouter';

import 'swiper/css';
import 'swiper/css/pagination';
interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
  const {data} = useQuery(echoKvGetQuery('home_carousel'));
  const [products, setProducts] = useState<typeof products>([]);
  const {show: showAlert} = useAlertStore();

  useEffect(() => {
    try {
      setProducts(parseEchoKVResponse<typeof products>(data));
    } catch (error) {
      showAlert(`公告板数据解析失败: ${error}`);
    }
  }, [data, showAlert]);

  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      loop
      autoplay={{delay: autoplayIntervalNum}}
      pagination={{clickable: true}}
      spaceBetween={30}
      slidesPerView={1}
      className="min-h-[200px]"
    >
      {products?.map((product, index) => (
        <SwiperSlide key={index}>
          <Link to={product?.link ?? ''}>
            <Grid container spacing={2} alignItems="center" sx={{px: 2}}>
              <Grid size={{xs: 12, sm: 3}}>
                <Box
                  component="img"
                  src={product.cover}
                  alt={product.title}
                  sx={{width: '100%', borderRadius: 1}}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 9}}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {product.title}
                </Typography>
                <Typography variant="body2">{product.lorem}</Typography>
              </Grid>
            </Grid>
          </Link>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};
