import React from 'react';
import { ExtendedPlugin } from '../types';

// 示例页面组件
const BookListPage = () => React.createElement('div', null, 'Book List Page');
const BookDetailPage = () => React.createElement('div', null, 'Book Detail Page');
const BookEditPage = () => React.createElement('div', null, 'Book Edit Page');

// 示例布局组件
const BookLayout = ({ children }: { children: React.ReactNode }) => 
  React.createElement('div', { className: 'book-layout' }, [
    React.createElement('header', { key: 'header' }, 'Book Header'),
    React.createElement('main', { key: 'main' }, children),
    React.createElement('footer', { key: 'footer' }, 'Book Footer')
  ]);

// 示例UI组件
const BookCard = ({ title, author }: { title: string; author: string }) =>
  React.createElement('div', { className: 'book-card' }, [
    React.createElement('h3', { key: 'title' }, title),
    React.createElement('p', { key: 'author' }, `By ${author}`)
  ]);

const BookSearch = ({ onSearch }: { onSearch: (query: string) => void }) =>
  React.createElement('div', { className: 'book-search' },
    React.createElement('input', {
      type: 'text',
      placeholder: 'Search books...',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)
    })
  );

// 示例功能
const searchBooks = (query: string) => {
  console.log(`Searching for books with query: ${query}`);
  return Promise.resolve([
    { id: 1, title: 'Sample Book 1', author: 'Author 1' },
    { id: 2, title: 'Sample Book 2', author: 'Author 2' }
  ]);
};

const getBookById = (id: string) => {
  console.log(`Getting book with id: ${id}`);
  return Promise.resolve({
    id,
    title: 'Sample Book',
    author: 'Sample Author',
    description: 'This is a sample book description.'
  });
};

const saveBook = (bookData: any) => {
  console.log('Saving book:', bookData);
  return Promise.resolve({ success: true, id: Date.now() });
};

// 书籍插件定义
export const BookPlugin: ExtendedPlugin = {
  id: 'book-plugin',
  name: 'Book Management Plugin',
  version: '1.0.0',
  description: 'A comprehensive plugin for book management functionality',
  author: 'Plugin Developer',
  type: 'route',
  enabled: true,
  dependencies: [],

  // 路由配置
  routes: [
    {
      path: '/books',
      component: BookListPage,
      layout: BookLayout,
      meta: {
        title: 'Book List',
        icon: '📚',
        requiresAuth: false
      }
    },
    {
      path: '/book/:id',
      component: BookDetailPage,
      layout: BookLayout,
      meta: {
        title: 'Book Detail',
        icon: '📖',
        requiresAuth: false
      }
    },
    {
      path: '/book/:id/edit',
      component: BookEditPage,
      layout: BookLayout,
      meta: {
        title: 'Edit Book',
        icon: '✏️',
        requiresAuth: true,
        permissions: ['book:edit']
      }
    }
  ],

  // 组件配置
  components: [
    {
      name: 'BookCard',
      component: BookCard,
      category: 'book',
      props: {
        title: 'Sample Book',
        author: 'Sample Author'
      }
    },
    {
      name: 'BookSearch',
      component: BookSearch,
      category: 'book',
      props: {
        onSearch: (query: string) => console.log('Search:', query)
      }
    }
  ],

  // 功能配置
  features: [
    {
      name: 'searchBooks',
      handler: searchBooks,
      category: 'book',
      permissions: []
    },
    {
      name: 'getBookById',
      handler: getBookById,
      category: 'book',
      permissions: []
    },
    {
      name: 'saveBook',
      handler: saveBook,
      category: 'book',
      permissions: ['book:edit']
    }
  ],

  // 生命周期钩子
  onInstall: async (context) => {
    console.log('Book plugin installed');
    context.utils.showNotification('Book plugin installed successfully', 'success');
  },

  onUninstall: async (context) => {
    console.log('Book plugin uninstalled');
    context.utils.showNotification('Book plugin uninstalled', 'warning');
  },

  onEnable: async (context) => {
    console.log('Book plugin enabled');
    context.utils.showNotification('Book plugin enabled', 'success');
  },

  onDisable: async (context) => {
    console.log('Book plugin disabled');
    context.utils.showNotification('Book plugin disabled', 'warning');
  }
};