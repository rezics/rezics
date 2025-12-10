import React, {useState} from 'react';
import {useLocation} from 'wouter';
import {MobileHomeQuickAccess} from './MobileHomeQuickAccess';

export const MobileHomeHeader: React.FC = () => {
  const [, navigate] = useLocation();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      navigate(`/book?keyword=${encodeURIComponent(keyword)}`);
    }
  };

  return (
    <section className="px-4 pt-4 pb-6 space-y-4 bg-background text-foreground">
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.35em] text-primary/80">
          Library Book
        </p>
        <h1 className="text-2xl font-semibold leading-snug">
          <span className="text-primary"> 与你爱的故事相遇</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          搜索想看的书，发现高质量书单、短评和金句。
        </p>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-sm p-3 space-y-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="搜索书名、作者、ISBN..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </form>

        {/* Quick Access */}
        <div className="-mx-1 overflow-x-auto scrollbar-hide">
          <div className="px-1 pb-1 min-w-max">
            <MobileHomeQuickAccess title="快捷探索" />
          </div>
        </div>
      </div>
    </section>
  );
};
