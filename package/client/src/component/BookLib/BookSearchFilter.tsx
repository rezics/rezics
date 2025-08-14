import React from "react";
import { Button, Menu, MenuItem, Stack, Typography } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import { SortControlsProps } from "@/component/Common/Pagination.tsx";
import { useTheme } from "@mui/material/styles";

export type BookLibSortKey =
    | "relevance"
    | "time"
    | "favorites"
    | "wordCount"
    | "monthVotes"
    | "recommend";

const LABELS: Partial<Record<BookLibSortKey, string>> = {
    relevance: "搜索相关性",
    time: "最新",
    favorites: "总收藏",
    wordCount: "总字数",
    monthVotes: "月票",
};

interface BookSearchFilterProps extends SortControlsProps {}

export const BookSearchFilter: React.FC<BookSearchFilterProps> = (
    { sortType, sortOrder, onSortChange },
) => {
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
    const theme = useTheme();

    const handleClick = (key: string) => (e: React.MouseEvent) => {
        if (key === "recommend") {
            // 推荐票用下拉菜单
            const el = e.currentTarget as HTMLElement;
            setAnchorEl(el);
            return;
        }
    };

    const handleSecondaryMenuSelect = (key: string) => () => {
        console.log(key);
        setAnchorEl(null);
    };

    return (
        <div className="flex justify-between">
            <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                className="book-search-filter mb-6"
            >
                {(Object.keys(LABELS) as BookLibSortKey[]).map((key) => {
                    const active = key === sortType;
                    return (
                        <Button
                            key={key}
                            onClick={() => onSortChange({ type: key })}
                            sx={{
                                backgroundColor: active
                                    ? theme.palette.secondary.main
                                    : "",
                            }}
                            // variant={active ? "outlined" : "contained" }
                        >
                            <Typography variant="body2">
                                {LABELS[key]}
                            </Typography>
                        </Button>
                    );
                })}
                <Button
                    onClick={handleClick("recommend")}
                    endIcon={<ArrowDropDownIcon fontSize="small" />}
                >
                    <Typography variant="body2">推荐</Typography>
                </Button>

                {/* “推荐票” 下拉菜单 */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={() => setAnchorEl(null)}
                >
                    <MenuItem onClick={handleSecondaryMenuSelect("weekVotes")}>
                        周推荐票
                    </MenuItem>
                    <MenuItem onClick={handleSecondaryMenuSelect("monthVotes")}>
                        月推荐票
                    </MenuItem>
                    <MenuItem onClick={handleSecondaryMenuSelect("totalVotes")}>
                        总推荐票
                    </MenuItem>
                </Menu>
            </Stack>
            <div>
                <Button
                    value="desc"
                    onClick={() => onSortChange({ order: "desc" })}
                    size="small"
                    sx={{
                        backgroundColor: sortOrder === "desc"
                            ? theme.palette.secondary.main
                            : "",
                        textTransform: "none",
                    }}
                >
                    <ArrowDownward />
                    &nbsp; 降序
                </Button>
                <Button
                    value="asc"
                    onClick={() => onSortChange({ order: "asc" })}
                    className="!ml-2"
                    size="small"
                    sx={{
                        backgroundColor: sortOrder === "asc"
                            ? theme.palette.secondary.main
                            : "",
                        textTransform: "none",
                    }}
                >
                    <ArrowUpward />
                    &nbsp; 升序
                </Button>
            </div>
        </div>
    );
};
