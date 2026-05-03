import { NavigationList } from "../navigation/NavigationList";
import type { NavigationItem } from "../navigation/navigation";
import { ListPlus as PlaylistAddOutlinedIcon, FilePlus as PostAddOutlinedIcon } from "lucide-react";

const CreateMenuNavigation: NavigationItem[] = [
  {
    kind: "item",
    segment: "/book/new",
    title: "New Book",
    icon: PostAddOutlinedIcon,
  },
  {
    kind: "item",
    title: "New Shelf",
    segment: "/shelf/new",
    icon: PlaylistAddOutlinedIcon,
  },
];

export const CreateMenuItem = ({ onClose }: { onClose: () => void }) => {
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
