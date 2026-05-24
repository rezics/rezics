import { BookEditMainPage } from "./InfoPage";

export function NewBookPage() {
  return (
    <div>
      <BookEditMainPage newBook={true} pageTitle="创建书籍" />
    </div>
  );
}
