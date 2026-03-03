import {MUILink} from '@package/ui/primitive/link/MUILink.tsx';

export function TestPage03() {
  const bookurl = '/book/019c3be6-2ffb-7cf0-b4eb-ecbd57c25f18';
  return (
    <div className="h-[500px] w-[500px] bg-black flex items-center justify-center">
      <img src="https://www.qidian.com/favicon.ico" alt="logo" />
      {/* <MUILink to={bookurl}>Home</MUILink> */}
    </div>
  );
}
