import {BookEditMainPage} from './InfoPage';
import {useUserProfileStore, type PartialUserDTO} from '@/user/state';

export function NewBookPage() {
  const user: PartialUserDTO | null = useUserProfileStore(state => state.user);

  return (
    <div>
      <BookEditMainPage newBook={true} pageTitle="创建书籍" />
    </div>
  );
}
