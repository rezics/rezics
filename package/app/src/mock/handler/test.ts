import {HttpResponse} from 'msw';

export function test01Handler(_body: any) {
  // return HttpResponse.json({ message: "Hello, world!" }, { status: 200 });
  return HttpResponse.json({message: 'Hello, world!'}, {status: 401});
}
