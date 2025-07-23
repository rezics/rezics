import React from "react";
import { Button, Menu, MenuItem, Stack, Typography } from "@mui/material";
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
    const [sortKey, setSortKey] = React.useState<SortKey>("relevance");
    const [asc, setAsc] = React.useState(false);
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

    const handleClick = (key: SortKey) => (e: React.MouseEvent) => {
        if (key === "recommend") {
            // 推荐票用下拉菜单
            const el = e.currentTarget as HTMLElement;
            setAnchorEl(el);
            return;
        }
        if (sortKey === key) {
            setAsc(!asc);
        } else {
            setSortKey(key);
            setAsc(false);
        }
    };

    const handleSecondaryMenuSelect = (key: string) => () => {
        console.log(key);
        setAnchorEl(null);
    };

    return (
        <Stack direction="row" spacing={2} alignItems="center" className="book-search-filter mb-6">
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
                <MenuItem onClick={handleSecondaryMenuSelect("weekVotes")}>周推荐票</MenuItem>
                <MenuItem onClick={handleSecondaryMenuSelect("monthVotes")}>月推荐票</MenuItem>
                <MenuItem onClick={handleSecondaryMenuSelect("totalVotes")}>总推荐票</MenuItem>
            </Menu>
        </Stack>
    );
};
