import React, {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {echoKvGetQuery} from '@package/api/echokv/echokv';
import {parseEchoKVResponse} from '@package/api/echokv/util';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';
import {Link} from '@package/ui/Navigation/Link.tsx';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/component/shadcn/carousel';

export const MobileHomeCarousel: React.FC = () => {
  const {data} = useQuery(echoKvGetQuery('home_carousel'));
  type CarouselProduct = {
    cover?: string;
    title?: string;
    lorem?: string;
    link?: string;
  };

  const [products, setProducts] = useState<CarouselProduct[]>([]);
  const carouselApiRef = useRef<CarouselApi | null>(null);

  useEffect(() => {
    setProducts(parseEchoKVResponse<CarouselProduct[]>(data) ?? []);
  }, [data]);

  // Autoplay
  useEffect(() => {
    const id = setInterval(() => {
      carouselApiRef.current?.scrollNext();
    }, 3000);
    return () => clearInterval(id);
  }, []);

  if (!products.length) return null;

  return (
    <div className="w-full">
      <Carousel
        opts={{loop: true}}
        className="w-full"
        setApi={api => (carouselApiRef.current = api)}
      >
        <CarouselContent className="-ml-0">
          {products.map((product, index) => (
            <CarouselItem key={index} className="pl-0">
              <Link
                to={product?.link ?? ''}
                className="block relative w-full aspect-[2/1]"
              >
                <LazyLoadImage
                  src={product.cover ?? ''}
                  alt={product.title ?? ''}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                  <div className="text-white">
                    <h3 className="font-bold text-lg line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-xs text-white/80 line-clamp-2">
                      {product.lorem}
                    </p>
                  </div>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};
