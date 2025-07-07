import React from "react";
import { Drawer, TextField, Button, Stack } from "@mui/material";
import { useDialogStore } from "@/global/dialogStore";

import EasyEditor from "./EasyEditor";

interface ReplyDrawerProps {
    dialogId: string;
    onSubmit?: (content: string) => void;
}

const ReplyDrawer: React.FC<ReplyDrawerProps> = ({ dialogId, onSubmit }) => {
    const entry = useDialogStore((state) => state.dialogs[dialogId]);
    const setDialogVisible = useDialogStore((state) => state.setDialogVisible);
    const setDialogContent = useDialogStore((state) => state.setDialogContent);

    const handleClose = () => {
        setDialogVisible(dialogId, false);
    };

    // const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     setDialogContent(dialogId, e.target.value);
    // };

    const handleSubmit = () => {
        if (onSubmit && entry?.contentMain !== undefined) {
            onSubmit(entry.contentMain);
        }
    };

    function handleChange(value: string) {
        setDialogContent(dialogId, value);
    }

    return (
        <Drawer open={entry?.visible ?? false} onClose={handleClose} anchor="bottom" sx={{ zIndex: 2000 }}>
            {/* 选择下方div的父元素，可以调整背景为透明 */}
            <div className="w-3/4 mx-auto flex gap-4 mt-4 min-h-[250px] h-[400px]">
                {/* 左边编辑器，占大部分宽度 */}
                <div className="flex-1">
                    <EasyEditor value={entry?.contentMain ?? ""} onChange={handleChange} />
                </div>

                {/* 右边按钮区域，竖排，从下往上 */}
                {/* 此时 h-full 都不再是必须的，因为 items-stretch (flex默认值) 会自动拉伸此div */}
                <div className="flex flex-col justify-end space-y-2">
                    <Button variant="contained" onClick={handleSubmit} className="!mb-2">
                        提交
                    </Button>
                    {/* 更多按钮可以继续加 */}
                </div>
            </div>
        </Drawer>
    );
};

export default ReplyDrawer;
