import { Box, Typography, Chip, Stack } from "@mui/material";
import { CollapsibleByLineText } from "@component/Common/CollapsibleByLineText";
import { TagGroup } from "contract/schema";

interface CustomChipProps {
    tag: string;
    onClick: (tag: string) => void;
}

const CustomChip: React.FC<CustomChipProps> = ({ tag, onClick }) => {
    return (
        <div
            className="inline-block rounded-lg py-1 px-3 mr-2 cursor-pointer"
            style={{
                backgroundColor: "#f1f1f1", // 背景色
                color: "#3f51b5", // 主色调
                display: "-webkit-box", // 确保 line-clamp 生效
                overflow: "hidden",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 1, // 限制文本为1行
                maxWidth: "200px", // 最大宽度，避免标签太长
                transition: "background-color 0.3s", // 平滑的背景色过渡
            }}
            onClick={() => onClick(tag)} // 点击事件
        >
            <span
                style={{
                    display: "block", // 确保 span 是块级元素
                    fontSize: "0.875rem", // 小字体大小
                }}
            >
                {tag}
            </span>
        </div>
    );
};

export function SingleBookTag({ data }: { data: TagGroup }) {
    return (
        <Box>
            <Typography variant="h6" fontWeight="bold">
                {data.name}
            </Typography>
            <CollapsibleByLineText.Container maxLines={2}>
                <div>
                    {data.tags.map((tag) => (
                        <Chip
                            key={tag}
                            label={`#${tag}`}
                            size="small"
                            onClick={() => {
                                console.log(`Clicked tag: ${tag}`);
                            }}
                            sx={{
                                bgcolor: "grey.100",
                                color: "primary.main",
                                "&:hover": {
                                    bgcolor: "grey.200",
                                },
                            }}
                        />
                    ))}
                </div>
            </CollapsibleByLineText.Container>
        </Box>
    );
}
