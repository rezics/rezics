import React from 'react';
import {Link} from '@package/ui/Navigation/Link.tsx';

export type BookProps = {
  title: string;
  author?: string;
  description?: string;
  coverUrl: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function BookCard({
  title,
  author,
  description,
  coverUrl,
  href,
  onClick,
  className,
}: BookProps) {
  const Root: React.ElementType = href ? Link : 'button';
  const rootProps = href ? {to: href} : {type: 'button' as const, onClick};

  return (
    <Root
      {...rootProps}
      className={['text-left', className ?? ''].join(' ')}
      aria-label={title}
    >
      <div className="relative w-full overflow-hidden">
        <img
          src={coverUrl}
          alt={title}
          className="w-full object-cover rounded"
          loading="lazy"
        />
      </div>

      <div className="mt-2">
        <div className="line-clamp-1 text-sm font-bold mb-1">{title}</div>

        {author ? <div className="text-sm">{author}</div> : null}

        {description ? (
          <div className="text-sm text-gray-500 line-clamp-2">
            {description}
          </div>
        ) : null}
      </div>
    </Root>
  );
}
