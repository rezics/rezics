import { Box, Grid, Typography } from "@mui/material";
import React from "react";
import { Autoplay, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import "swiper/css";
import "swiper/css/pagination";

const products = [
  {
    title: "Book 1",
    cover: "https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg",
  },
  {
    title: "Book 2",
    cover: "https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg",
  },
  {
    title: "Book 3",
    cover: "https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg",
  },
  {
    title: "Book 4",
    cover: "https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg",
  },
];

const lorem =
  `书评：这是一个书评，即评论并介绍书籍的文章，是以“书”为对象，实事求是的、有见识的分析书籍的形式和内容，探求创作的思想性、学术性、知识性和艺术性，从而在作者、读者和出版商之间构建信息交流的渠道。书评是应用写作的一种重要文体。`;

interface BookCarouselProps {
  autoplayIntervalNum?: number;
}

export const BookCarousel: React.FC<BookCarouselProps> = ({
  autoplayIntervalNum = 3000,
}) => {
  return (
    <Swiper
      modules={[Autoplay, Pagination]}
      loop
      autoplay={{ delay: autoplayIntervalNum }}
      pagination={{ clickable: true }}
      spaceBetween={30}
      slidesPerView={1}
    >
      {products.map((product, index) => (
        <SwiperSlide key={index}>
          <Grid
            container
            spacing={2}
            alignItems="center"
            sx={{ px: 2 }}
          >
            <Grid size={{ xs: 12, sm: 3 }}>
              <Box
                component="img"
                src={product.cover}
                alt={product.title}
                sx={{ width: "100%", borderRadius: 1 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 9 }}>
              <Typography
                variant="h6"
                fontWeight="bold"
                gutterBottom
              >
                {product.title}
              </Typography>
              <Typography variant="body2">{lorem}</Typography>
            </Grid>
          </Grid>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};
