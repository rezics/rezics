import DashboardIcon from "@mui/icons-material/Dashboard";
// import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
// import BarChartIcon from "@mui/icons-material/BarChart";
// import LayersIcon from "@mui/icons-material/Layers";
// import ErrorIcon from "@mui/icons-material/Error";
// import PersonIcon from "@mui/icons-material/Person";
// import LoginIcon from "@mui/icons-material/Login";
// import HowToRegIcon from "@mui/icons-material/HowToReg";
// import BookIcon from "@mui/icons-material/Book";
// import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
// import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import DescriptionIcon from "@mui/icons-material/Description";
// import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";

import { NavigationItem } from "./navigation";
import { get } from "@locale";

// segment: router path

export const NAVIGATION: NavigationItem[] = [
    {
        kind: "item",
        title: get("navigation->back_to_main"),
        segment: "~/",
        icon: <DashboardIcon />,
    },
    {
        kind: "header",
        title: get("navigation->book_editor_navigation"),
    },

    {
        kind: "item",
        title: get("navigation->book_edit_main"),
        segment: "~/book/1/edit",
        icon: <DescriptionIcon />,
    },
    {
        kind: "item",
        title: get("navigation->book_edit_chapter"),
        segment: "~/book/1/edit/323",
        icon: <DescriptionIcon />,
    },
    {
        kind: "divider",
    },
    // {
    //     kind: "header",
    //     title: "Chapter Navigation",
    // },
    // {
    //     kind: "item",
    //     segment: "~/book/1/edit/1",
    //     title: "Chapter 1",
    //     icon: <DescriptionIcon />,
    // },
];
