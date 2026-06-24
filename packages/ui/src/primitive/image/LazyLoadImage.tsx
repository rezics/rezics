import type React from "react";
import { LazyLoadImage as ReactLazyLoadImage } from "react-lazy-load-image-component";
import "react-lazy-load-image-component/src/effects/opacity.css";

type LazyLoadImageProps = {
  alt: string;
  height?: number;
  src: string;
  width?: number;
  className?: string;
  style?: React.CSSProperties;
  wrapperClassName?: string;
};

export const LazyLoadImage = ({
  alt,
  height,
  src,
  width,
  className,
  style,
}: LazyLoadImageProps) => (
  <ReactLazyLoadImage
    className={className}
    wrapperClassName={className}
    alt={alt}
    effect="opacity"
    height={height}
    src={src}
    width={width}
    style={style}
  />
);
