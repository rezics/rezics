import {useUserStore} from '@/global/userStore.ts';
import {Button} from '@mui/material';

export function TestPage02() {
  const user = useUserStore(state => state.user);
  return (
    <div>
      <h1>Test Page 02</h1>
      <p>User: {user?.name}</p>
      <p>{user?.email}</p>
      <div className="flex gap-2 w-[200px]">
        <div className="">01</div>
        {/* <div className="flex-1">02</div> */}
        <div className="flex flex-1 justify-end">03</div>
      </div>
      <div>
        <a href="https://chatgpt.com/c/690d84f5-332c-8324-9a2f-db463a8478ed">
          Home
        </a>
      </div>
    </div>
  );
}
