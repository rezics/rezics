import React from 'react';
import {Chip} from '@mui/material';
import {Link} from 'wouter';

const presets = [
  '文学',
  '经济',
  '漫画',
  '历史',
  '科幻',
  '哲学',
  '传记',
  '技术',
];

export type HomeQuickAccessLinksProps = {
  title?: string;
  items?: string[];
};

export const HomeQuickAccessLinks: React.FC<HomeQuickAccessLinksProps> = ({
  title = '快速入口',
  items = presets,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold">{title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(name => (
          <Link key={name} href="/books">
            <Chip label={name} variant="filled" clickable />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default HomeQuickAccessLinks;
