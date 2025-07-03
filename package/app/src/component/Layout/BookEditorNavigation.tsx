import React from "react";
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

// segment: router path

export const NAVIGATION: NavigationItem[] = [
    {
        kind: "item",
        title: "Back to Main",
        segment: "~/",
        icon: <DashboardIcon />,
    },
    {
        kind: "header",
        title: "Book Editor Navigation",
    },

    {
        kind: "item",
        title: "Book Edit Main",
        segment: "~/book/1/edit",
        icon: <DescriptionIcon />,
    },
    {
        kind: "item",
        title: "Book Edit Chapter",
        segment: "~/book/1/edit/2",
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
