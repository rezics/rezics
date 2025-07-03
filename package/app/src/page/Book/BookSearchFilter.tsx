import React from "react";
import { Box, Button, Menu, MenuItem, Stack, Typography, useTheme } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

type SortKey = "relevance" | "updated" | "favorites" | "wordCount" | "recommend" | "monthVotes";

const LABELS: Record<SortKey, string> = {
    relevance: "搜索相关性",
    updated: "更新时间",
    favorites: "总收藏",
    wordCount: "总字数",
    recommend: "推荐票",
    monthVotes: "月票",
};

export const BookSearchFilter = () => {
    const theme = useTheme();
    const [sortKey, setSortKey] = React.useState<SortKey>("relevance");
    const [asc, setAsc] = React.useState(false);
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

    const handleClick = (key: SortKey) => (e: React.MouseEvent) => {
        if (key === "recommend") {
            // 推荐票用下拉菜单
            // setAnchorEl(e.currentTarget);
            return;
        }
        if (sortKey === key) {
            setAsc(!asc);
        } else {
            setSortKey(key);
            setAsc(false);
        }
    };

    const handleMenuSelect = (key: SortKey) => () => {
        setSortKey(key);
        setAsc(false);
        setAnchorEl(null);
    };

    return (
        <Stack direction="row" spacing={2} alignItems="center">
            {(Object.keys(LABELS) as SortKey[]).map((key) => {
                const active = key === sortKey;
                return (
                    <Button
                        key={key}
                        onClick={handleClick(key)}
                        disableRipple
                        sx={{
                            // color: active ? theme.palette.secondary.contrastText : "#3d3d3d",
                            fontWeight: active ? "bold" : "normal",
                            textTransform: "none",
                        }}
                        endIcon={
                            active ? (
                                asc ? (
                                    <ArrowUpwardIcon fontSize="small" />
                                ) : (
                                    <ArrowDownwardIcon fontSize="small" />
                                )
                            ) : key === "recommend" ? (
                                <ArrowDropDownIcon fontSize="small" />
                            ) : undefined
                        }
                    >
                        <Typography variant="body2">{LABELS[key]}</Typography>
                    </Button>
                );
            })}

            {/* “推荐票” 下拉菜单 */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={handleMenuSelect("recommend")}>推荐票</MenuItem>
                <MenuItem onClick={handleMenuSelect("monthVotes")}>月票</MenuItem>
            </Menu>
        </Stack>
    );
}
