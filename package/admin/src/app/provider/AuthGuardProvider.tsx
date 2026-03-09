import {useEffect} from 'react';
import {useRouter} from '@tanstack/react-router';

import {getToken} from '@package/api/react-query/jwt';

export function AuthGuardProvider() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();

    console.log('Auth token', token);

    if (!token) {
      console.log('Redirecting to login');
      router.navigate({
        to: '/login',
        replace: true,
        search: {redirect: '/'},
      });
    }
  }, [router]);

  return null;
}
