import {
    Paper,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ToggleButtonGroup,
    ToggleButton,
    Box,
    Typography,
    LinearProgress,
    Pagination,
} from "@mui/material";
import { useState, useMemo, useCallback } from "react";
import { ArrowDownward, ArrowUpward } from "@mui/icons-material";

interface SortControlsProps {
    sortType: string;
    sortOrder: "asc" | "desc";
    onSortChange: (newSort: { type?: string; order?: "asc" | "desc" }) => void;
}
const SortControls: React.FC<SortControlsProps> = ({ sortType, sortOrder, onSortChange }) => {
    const sortOptions = [
        { value: "time", label: "按时间" },
        { value: "name", label: "按名称" },
        { value: "popular", label: "按热度" },
        { value: "agree", label: "按赞同数" },
    ];
    return (
        <Paper elevation={1} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
                <Grid sx={{ xs: 12, sm: "auto" }}>
                    <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>排序方式</InputLabel>
                        <Select
                            value={sortType}
                            label="排序方式"
                            onChange={(e) => onSortChange({ type: e.target.value as string })}
                        >
                            {sortOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid sx={{ xs: 12, sm: "auto" }}>
                    <ToggleButtonGroup
                        value={sortOrder}
                        exclusive
                        onChange={(_, v: "asc" | "desc" | null) => v && onSortChange({ order: v })}
                    >
                        <ToggleButton value="desc">
                            <ArrowDownward />
                            &nbsp; 降序
                        </ToggleButton>
                        <ToggleButton value="asc">
                            <ArrowUpward />
                            &nbsp; 升序
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Grid>
            </Grid>
        </Paper>
    );
};

interface PaginationBarProps {
    page: number;
    totalPages: number;
    onPageChange: (event: React.ChangeEvent<unknown>, page: number) => void;
}
const PaginationBar: React.FC<PaginationBarProps> = ({ page, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2, mt: 2 }}>
            <Pagination
                count={totalPages}
                page={page}
                onChange={onPageChange}
                color="primary"
                showFirstButton
                showLastButton
            />
        </Box>
    );
};

interface UniversalPaginatorProps<T> {
    data: T[];
    totalExternalItems: number;
    itemsPerPage?: number;
    externalItemsPerPage?: number;
    sortType: string;
    sortOrder: "asc" | "desc";
    onSortChange: (newSort: { type?: string; order?: "asc" | "desc" }) => void;
    onNeedMoreData: (externalPage: number) => void;
    children: (currentPageItems: T[]) => React.ReactNode;
    isLoading?: boolean;
}
// TODO 分页数量计算似乎是错误的
// 错误的原因是请求之后，数据是从第一页开始渲染，这个逻辑是不对的。所以判断哪一页需要请求也是需要修改的
export const UniversalPaginator = <T,>({
    data,
    totalExternalItems,
    itemsPerPage = 30,
    externalItemsPerPage = 100,
    sortType,
    sortOrder,
    onSortChange,
    onNeedMoreData,
    children,
    isLoading = false,
}: UniversalPaginatorProps<T>) => {
    const [currentPage, setCurrentPage] = useState<number>(1);

    // 这么写的话会导致刷新后回到第一页
    // useEffect(() => {
    //     setCurrentPage(1);
    // }, [sortType, sortOrder, data]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(totalExternalItems / itemsPerPage)),
        [totalExternalItems, itemsPerPage],
    );

    const currentPageItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return data.slice(startIndex, startIndex + itemsPerPage);
    }, [data, currentPage, itemsPerPage]);

    const handlePageChange = useCallback(
        (_: React.ChangeEvent<unknown>, newPage: number) => {
            const requiredItemsCount = newPage * itemsPerPage;
            console.log("pageChange", requiredItemsCount, data.length, totalExternalItems);
            if (requiredItemsCount > data.length && data.length < totalExternalItems) {
                const requiredExternalPage = Math.ceil(requiredItemsCount / externalItemsPerPage);
                console.log("requiredExternalPage", requiredExternalPage);
                onNeedMoreData(requiredExternalPage);
            }
            setCurrentPage(newPage);
        },
        [data, totalExternalItems, itemsPerPage, externalItemsPerPage, onNeedMoreData],
    );

    return (
        <Box>
            <SortControls sortType={sortType} sortOrder={sortOrder} onSortChange={onSortChange} />
            <Box sx={{ minHeight: 300, position: "relative" }}>
                {isLoading && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, width: "100%" }} />}
                {children(currentPageItems)}
                {!isLoading && currentPageItems.length === 0 && (
                    <Typography sx={{ textAlign: "center", p: 5 }}>没有内容。</Typography>
                )}
            </Box>
            <PaginationBar page={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </Box>
    );
};
