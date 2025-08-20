import { ArrowDownward, ArrowUpward } from "@mui/icons-material";
import {
    Box,
    FormControl,
    Grid,
    InputLabel,
    LinearProgress,
    MenuItem,
    Pagination,
    Paper,
    Select,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * example:
 * ```ts
 *   const [sortConfig, setSortConfig] = useState<{
 *       type: "time" | "name" | "popular" | "agree";
 *       order: "asc" | "desc";
 *   }>({
 *       type: "popular",
 *       order: "desc",
 *   });
 *   ```
 */
export interface SortControlsProps {
    sortType: string;
    sortOrder: "asc" | "desc";
    onSortChange: (newSort: { type?: string; order?: "asc" | "desc" }) => void;
}
/**
 * SortControls
 * @param {SortControlsProps} props
 */
const SortControls: React.FC<SortControlsProps> = (
    { sortType, sortOrder, onSortChange },
) => {
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
                            onChange={(e) =>
                                onSortChange({
                                    type: e.target.value as string,
                                })}
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
const PaginationBar: React.FC<PaginationBarProps> = (
    { page, totalPages, onPageChange },
) => {
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

interface UniversalPaginatorProps<T> extends SortControlsProps {
    data: T[];
    totalExternalItems: number;
    itemsPerPage?: number;
    externalItemsPerPage?: number;
    requestData: (externalPage: number) => void;
    children: (currentPageItems: T[]) => React.ReactNode;
    sortControl?: React.ReactElement<SortControlsProps>;
    isLoading?: boolean;
    currentPage: number;
    setCurrentPage: (page: number) => void;
}

/**
 * UniversalPaginator
 * @param {UniversalPaginatorProps<T>} props
 * @returns {React.ReactNode}
 * @todo Add an option to keep the page scrolled to the bottom to prevent it from jumping to the top when new data loads.
 */
export const UniversalPaginator = <T,>({
    data,
    totalExternalItems,
    itemsPerPage = 30,
    externalItemsPerPage = 100,
    sortType,
    sortOrder,
    onSortChange,
    requestData,
    children,
    sortControl,
    isLoading = false,
    currentPage = 1,
    setCurrentPage,
}: UniversalPaginatorProps<T>) => {
    // const [currentPage, setCurrentPage] = useState<number>(1);
    const internalPagesPerExternalPage = useMemo(
        () => Math.ceil(externalItemsPerPage / itemsPerPage),
        [externalItemsPerPage, itemsPerPage],
    );
    const externalPage = useMemo(
        () => Math.ceil(currentPage / internalPagesPerExternalPage),
        [currentPage, internalPagesPerExternalPage],
    );
    const rangeStartPage = useMemo(
        () => (externalPage - 1) * internalPagesPerExternalPage + 1,
        [externalPage, internalPagesPerExternalPage],
    );
    const globalStartIndex = useMemo(
        () =>
            (currentPage - rangeStartPage) * itemsPerPage
            + (externalPage - 1) * externalItemsPerPage,
        [
            currentPage,
            rangeStartPage,
            itemsPerPage,
            externalPage,
            externalItemsPerPage,
        ],
    );

    useEffect(() => {
        requestData(externalPage);
        console.log("requestData", externalPage);
    }, [externalPage]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(totalExternalItems / itemsPerPage)),
        [totalExternalItems, itemsPerPage],
    );

    const currentPageItems = useMemo(() => {
        const startIndex = (currentPage - rangeStartPage) * itemsPerPage;
        console.log(
            "currentPageItems",
            "currentPage",
            currentPage,
            "globalStartIndex",
            globalStartIndex,
            "externalPage",
            externalPage,
            "data.length",
            data.length,
        );
        console.log(
            "rangeStartPage",
            rangeStartPage,
            "startIndex",
            startIndex,
            "endIndex",
            startIndex + itemsPerPage - 1,
        );
        return data.slice(startIndex, startIndex + itemsPerPage); // no minus 1, because slice is not inclusive
    }, [data, currentPage, itemsPerPage, externalItemsPerPage]);

    const handlePageChange = useCallback(
        (_: React.ChangeEvent<unknown>, newPage: number) => {
            console.log(
                "pageChange",
                newPage,
                rangeStartPage,
                globalStartIndex,
                internalPagesPerExternalPage,
                externalPage,
            );
            setCurrentPage(newPage);
        },
        [
            data,
            totalExternalItems,
            itemsPerPage,
            externalItemsPerPage,
            requestData,
        ],
    );

    return (
        <Box>
            {sortControl || (
                <SortControls
                    sortType={sortType}
                    sortOrder={sortOrder}
                    onSortChange={onSortChange}
                />
            )}
            <Box sx={{ minHeight: 300, position: "relative" }}>
                {isLoading && (
                    <LinearProgress
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                        }}
                    />
                )}
                {children(currentPageItems)}
                {!isLoading && currentPageItems.length === 0 && (
                    <Typography sx={{ textAlign: "center", p: 5 }}>
                        没有内容。
                    </Typography>
                )}
            </Box>
            <PaginationBar
                page={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />
        </Box>
    );
};
