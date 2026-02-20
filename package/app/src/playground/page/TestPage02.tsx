import {useUserStore} from '@/global/userStore.ts';
import {Button, Typography} from '@mui/material';
import {LinearChapterList} from '@/book-library/component/Chapter/LinearChapterList';

export function TestPage02() {
  const user = useUserStore(state => state.user);
  const product = {
    title: 'Product 1',
    lorem: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    cover: 'https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg',
  };
  return (
    <div className="w-[300px]">
      <h1>Test Page 02</h1>
      <div>
        <LinearChapterList bookId="019ad692-58c6-74c0-899a-286447a34ae3" />
      </div>
    </div>
  );
}
