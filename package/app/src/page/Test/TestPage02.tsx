import {useUserStore} from '@/global/userStore.ts';
import {Button} from '@mui/material';

export function TestPage02() {
  const user = useUserStore(state => state.user);
  return (
    <div>
      <h1>Test Page 02</h1>
      <p>User: {user?.name}</p>
      <p>{user?.email}</p>
      <p>{user?.role}</p>
      <p>{user?.id}</p>
      <div>
        <a href="https://chatgpt.com/c/690d84f5-332c-8324-9a2f-db463a8478ed">
          Home
        </a>
      </div>
    </div>
  );
}
