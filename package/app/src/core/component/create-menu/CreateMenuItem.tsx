import PlaylistAddOutlinedIcon from "@mui/icons-material/PlaylistAddOutlined";
import PostAddOutlinedIcon from "@mui/icons-material/PostAddOutlined";
import { NavigationList } from "../navigation/NavigationList";
import type { NavigationItem } from "../navigation/navigation";

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
