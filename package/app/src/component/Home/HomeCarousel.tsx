import {Box, Grid, Typography} from '@mui/material';
import React, {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {echoKvGetQuery} from '@/api/echokv/echokv';
import {parseEchoKVResponse} from '@/api/echokv/util';
import {useAlertStore} from '@/global/windowAlertStore';
import {Link} from 'wouter';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/component/ui/carousel';
interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
  const {data} = useQuery(echoKvGetQuery('home_carousel'));
  type CarouselProduct = {
    cover?: string;
    title?: string;
    lorem?: string;
    link?: string;
  };

  const [products, setProducts] = useState<CarouselProduct[]>([]);
  const {show: showAlert} = useAlertStore();
  const carouselApiRef = useRef<CarouselApi | null>(null);

  useEffect(() => {
    try {
      setProducts(parseEchoKVResponse<CarouselProduct[]>(data) ?? []);
    } catch (error) {
      showAlert(`公告板数据解析失败: ${error}`);
    }
  }, [data, showAlert]);

  // autoplay using carousel api
  useEffect(() => {
    if (!autoplayIntervalNum) return;

    const id = setInterval(() => {
      try {
        carouselApiRef.current?.scrollNext();
      } catch (e) {
        // ignore if api not ready
      }
    }, autoplayIntervalNum);

    return () => clearInterval(id);
  }, [autoplayIntervalNum]);

  return (
    <Carousel
      opts={{loop: true}}
      className="min-h-[200px]"
      setApi={api => (carouselApiRef.current = api)}
    >
      <CarouselContent>
        {products?.map((product, index) => (
          <CarouselItem key={index}>
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
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
