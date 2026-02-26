import {createFileRoute, redirect} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/book/$bookId/')({
  beforeLoad: ({params}) => {
    throw redirect({to: '/book/$bookId/info', params});
  },
});
