import {
  ListPlus as PlaylistAddOutlinedIcon,
  FilePlus as PostAddOutlinedIcon,
} from "lucide-react";
import { useTranslation } from "@rezics/i18n/react";
import { NavigationList } from "../navigation/NavigationList";
import type { NavigationItem } from "../navigation/navigation";

export const CreateMenuItem = ({ onClose }: { onClose: () => void }) => {
  // Translation: Create menu items for new book and new shelf entries
  // 翻译：新建书籍和新建书架菜单项
  const { t } = useTranslation("shell");

  // Translation: Build navigation items with translated titles
  // 翻译：使用翻译后的标题构建导航项
  const CreateMenuNavigation: NavigationItem[] = [
    {
      kind: "item",
      segment: "/book/new",
      title: t("create_menu_new_book"),
      icon: PostAddOutlinedIcon,
    },
    {
      kind: "item",
      title: t("create_menu_new_shelf"),
      segment: "/shelf/new",
      icon: PlaylistAddOutlinedIcon,
    },
  ];

  const handleClick = () => {
    onClose();
  };

  return (
    <NavigationList
      NAVIGATION={CreateMenuNavigation}
      isMobile={false}
      pathname={"/"}
      openItems={{}}
      handleItemClick={handleClick}
    />
  );
};
