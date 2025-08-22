import { TabContext, TabList, TabPanel } from "@mui/lab";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import * as React from "react";

import { apiPost } from "@/api/swr.ts";
import { BookEditorSidebar } from "@/component/Layout/BookEditorSidebar.tsx";
import { ThemeDemo } from "@/component/Theme/ThemeDemo.tsx";
import useSWR from "swr";

export default function PersistentTabs() {
    const [value, setValue] = React.useState<"1" | "2">("1");

    const createChapterListInput = {
        operation: "chapter.list",
        parameter: { bookId: "0" },
        select: {
            id: true,
            title: true,
        },
    };

    const { data, isLoading, error } = useSWR(createChapterListInput, apiPost);

    const handleChange = (_: React.SyntheticEvent, newValue: "1" | "2") => {
        setValue(newValue);
    };

    const createTestInput = {
        operation: "test.01",
        parameter: { bookId: "0" },
    };
    const { data: testData, isLoading: testLoading, error: testError } = useSWR(
        createTestInput,
        apiPost,
    );

    return (
        <div>
            <div>
                <p className="text-blue-600 dark:text-gray-400">
                    用 div tailwind css 重写，并重新布局，Avatar 依然放在左边，但是改为方形，右侧内则分为三个DIV
                </p>
            </div>
            <ThemeDemo />
            <TabContext value={value}>
                {" "}
                {/* ① 提供上下文 */}
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <TabList
                        onChange={handleChange}
                        aria-label="lab API tabs example"
                    >
                        <Tab label="面板一" value="1" />
                        <Tab label="面板二" value="2" />
                    </TabList>
                </Box>
                {/* ② TabPanel 的 value 必须和 Tab 的 value 对应 */}
                <TabPanel value="1" keepMounted>
                    {/* keepMounted 保持在 DOM，不会被卸载，内部状态持久化】 */}
                    <BookEditorSidebar
                        chaptersData={data as any ?? { chapters: [], order: new Map() as any }}
                        selectedId=""
                        baseLink="/test"
                        drawerWidth={300}
                    />
                </TabPanel>
                <TabPanel value="2" keepMounted>
                    <div>SWR Test</div>
                    <div>{String(testData)}</div>
                    <div>{String(testLoading)}</div>
                    <div>{String(testError)}</div>
                    <div className="mt-100" />
                </TabPanel>
            </TabContext>
        </div>
    );
}
