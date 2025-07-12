import * as React from "react";
import Box from "@mui/material/Box";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import Tab from "@mui/material/Tab";

import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar";
import { ChapterListQuery } from "@/api/book";
import { useQuery } from "urql";

export default function PersistentTabs() {
    const [value, setValue] = React.useState<"1" | "2">("1");

    const [{ data }] = useQuery({
        query: ChapterListQuery,
        variables: { id: "1" },
    });

    const handleChange = (_: React.SyntheticEvent, newValue: "1" | "2") => {
        setValue(newValue);
    };

    return (
        <TabContext value={value}>
            {" "}
            {/* ① 提供上下文 */}
            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                <TabList onChange={handleChange} aria-label="lab API tabs example">
                    <Tab label="面板一" value="1" />
                    <Tab label="面板二" value="2" />
                </TabList>
            </Box>
            {/* ② TabPanel 的 value 必须和 Tab 的 value 对应 */}
            <TabPanel value="1" keepMounted>
                {/* keepMounted 保持在 DOM，不会被卸载，内部状态持久化】 */}
                <BookEditorSidebar chaptersData={data} selectedId="" baseLink="/test" />
            </TabPanel>
            <TabPanel value="2" keepMounted>
                这是第二个面板的内容
            </TabPanel>
        </TabContext>
    );
}
