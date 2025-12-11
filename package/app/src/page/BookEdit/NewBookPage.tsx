import {BookEditMainPage} from './InfoPage';
import {useUserStore, type PartialUserDTO} from '@/global/userStore';

export function NewBookPage() {
  const user: PartialUserDTO | null = useUserStore(state => state.user);

  return (
    <div>
      <BookEditMainPage newBook={true} pageTitle="创建书籍" />
    </div>
  );
}
