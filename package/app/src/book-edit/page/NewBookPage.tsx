import { type PartialUserDTO, useUserProfileStore } from "@/user/state";
import { BookEditMainPage } from "./InfoPage";

export function NewBookPage() {
  const _user: PartialUserDTO | null = useUserProfileStore(
    (state) => state.user,
  );

  return (
    <div>
      <BookEditMainPage newBook={true} pageTitle="创建书籍" />
    </div>
  );
}
