import {Rating} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from '@package/ui/Navigation/Link.tsx';

import type {BookDTO} from '@package/contract';
import {
  MiniActionBar,
  MiniAdminActionBar,
} from '../Common/Reaction/MiniActionBar';
import {LazyLoadImage} from '../Common/LazyLoadImage';

type Book = BookDTO;

export const BookHeroReactionBar: React.FC<{
  bookInfo: any;
  className?: string;
}> = ({bookInfo, className}) => {
  const color = 'text-white';
  return (
    <div className={className}>
      <MiniAdminActionBar
        editionURL={`/book/${bookInfo?.unitId}/edit`}
        textColor={color}
        userUnitId={bookInfo?.user?.unitId}
      />
      <MiniActionBar
        hideReply={true}
        className={className ?? ''}
        textColor={color}
        unitId={bookInfo?.unitId}
      />
    </div>
  );
};

export const BookHeroShow: React.FC<{
  bookInfo: Book;
  rating: number;
}> = ({bookInfo, rating}) => {
  const {t} = useTranslation();
  const tags = bookInfo?.tags ?? [];
  return (
    <div
      className="bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${bookInfo?.coverUrl || ''})`,
      }}
    >
      <div className="bg-black/60 backdrop-blur-md shadow-lg w-full">
        <div className="container mx-auto max-w-[1250px] py-6 grid grid-cols-12 gap-6 px-4">
          {/* Cover Image */}
          <div className="col-span-4 md:col-span-3 lg:col-span-2 flex justify-center">
            <LazyLoadImage
              src={bookInfo?.coverUrl || ''}
              alt={bookInfo?.title}
              className="max-h-[300px] rounded-lg"
            />
          </div>

          {/* Book Info */}
          <div className="col-span-8 md:col-span-6 text-white flex flex-col gap-3">
            <h1 className="text-2xl font-bold break-words">
              {bookInfo?.title}
            </h1>

            <div className="space-y-1">
              <p>
                {t('book.fields.author')}：
                <span className="font-medium">
                  {bookInfo?.author?.[0]?.name}
                </span>
              </p>
              <p>
                {t('book.fields.press')}：{bookInfo?.press?.[0]?.name}
              </p>
              <p>
                {t('book.fields.producer')}：{bookInfo?.producer?.[0]?.name}
              </p>
              <p>
                {t('book.fields.text_length')}：{bookInfo?.textLength ?? 0}
              </p>
              <p>
                {t('book.fields.isbn')}：{bookInfo?.isbn}
              </p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-1">
              {tags?.map(tag => (
                <Link key={tag} to="/book" search={{tags: tag}}>
                  <span className="px-2 py-1 rounded bg-white/10 text-white hover:bg-white/20 transition">
                    {tag}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Rating + Reaction */}
          <div className="col-span-12 md:col-span-3 lg:col-span-4">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Rating value={rating} precision={0.5} readOnly size="large" />
                <span className="text-2xl text-amber-500">{rating} / 10</span>
              </div>
              <BookHeroReactionBar bookInfo={bookInfo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export type Container = {
  bookInfo: Book;
  rating: number;
};

export const BookHeroContainer: React.FC<Container> = ({bookInfo, rating}) => {
  return <BookHeroShow bookInfo={bookInfo} rating={rating} />;
};
