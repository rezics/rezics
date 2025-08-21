// AuthorInfo.tsx  —— ES Module 版本（无 namespace）
import { AccentBarWithText } from "@component/Common/AccentBar.tsx";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight.tsx";
import EasyEditor from "@component/Form/EasyEditor.tsx";
import { Box, Button, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DialogContainer from "../Common/DialogContainer.tsx";

// --------- Types ---------
export interface Author {
    name: string;
    avatar?: string | null;
    description: string | null | undefined;
}

// --------- Small parts ---------
const FollowButton: React.FC<{ author: Author }> = ({ author }) => {
    const [following, setFollowing] = useState(false);
    const handleFollow = () => setFollowing((v) => !v);

    return (
        <div className="mt-2 mx-auto flex justify-center">
            <Button
                variant="contained"
                color={following ? "secondary" : "primary"}
                onClick={handleFollow}
            >
                {following ? "Unfollow" : "Follow"} {author.name}
            </Button>
        </div>
    );
};

// --------- AuthorInfo.Show ---------
export type AuthorInfoShowProps = {
    author: Author;
    onEdit?: () => void;
    showEditButton?: boolean;
    editOpen?: boolean;
    setEditOpen?: React.Dispatch<React.SetStateAction<boolean>>;
};

const AuthorInfoShow: React.FC<AuthorInfoShowProps> = ({
    author,
    onEdit,
    showEditButton = true,
    editOpen,
    setEditOpen,
}) => {
    const { t } = useTranslation();

    return (
        <div>
            <Box>
                <div className="flex mb-4">
                    <AccentBarWithText.Show text={t("book.authorInfo") + " " + author?.name} />
                    {/* <FollowButton author={author} /> */}
                    {showEditButton && <EditButtonFloatRight.Show onClick={onEdit} />}
                </div>

                <div className="whitespace-pre-line">
                    <Box>
                        <Box className="mb-4 mt-2 flex">
                            {/* 左侧图片区域 */}
                            <div className="w-1/5 flex-row justify-center">
                                <img
                                    src={author.avatar || ""}
                                    className="max-w-full max-h-full object-contain"
                                    alt="avatar"
                                />
                                <FollowButton author={author} />
                            </div>

                            {/* 分割线 */}
                            <div className="h-auto border-l border-gray-300 mx-4" />

                            {/* 右侧文本区域 */}
                            <Typography className="flex-1 !text-md">
                                {author.description}
                            </Typography>
                        </Box>
                    </Box>
                </div>
            </Box>

            <AuthorInfoEdit.Container
                author={author}
                editOpen={editOpen ?? false}
                setEditOpen={setEditOpen!}
                mode="modal"
            />
        </div>
    );
};

// --------- AuthorInfo.Container ---------
export type AuthorInfoContainerProps = {
    author: Author;
};

const AuthorInfoContainer: React.FC<AuthorInfoContainerProps> = ({ author }) => {
    const [editOpen, setEditOpen] = useState(false);
    const handleEdit = () => setEditOpen(true);

    return (
        <AuthorInfoShow
            author={author}
            onEdit={handleEdit}
            editOpen={editOpen}
            setEditOpen={setEditOpen}
        />
    );
};

// --------- AuthorInfoEdit.Show ---------
export type AuthorInfoEditShowProps = {
    author: Author;
    onUpdate: (description: string) => void;
    setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
    descriptionState: any;
    setDescriptionState: React.Dispatch<any>;
};

const AuthorInfoEditShow: React.FC<AuthorInfoEditShowProps> = ({
    onUpdate,
    setEditOpen,
    descriptionState,
    setDescriptionState,
}) => {
    const handleUpdate = () => {
        onUpdate(descriptionState);
        setEditOpen(false);
    };

    return (
        <div>
            <EasyEditor value={descriptionState} onChange={setDescriptionState} />
            <div className="w-full">
                <div className="w-1/2 float-right">
                    <Button onClick={handleUpdate} className="w-full">
                        提交
                    </Button>
                </div>
            </div>
        </div>
    );
};

// --------- AuthorInfoEdit.Container ---------
export type AuthorInfoEditContainerProps = {
    author: Author;
    editOpen: boolean;
    setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
    mode?: "modal" | "inline";
};

const AuthorInfoEditContainer: React.FC<AuthorInfoEditContainerProps> = ({
    author,
    editOpen,
    setEditOpen,
    mode = "inline",
}) => {
    const [descriptionState, setDescriptionState] = useState(author.description);

    useEffect(() => {
        setDescriptionState(author.description);
    }, [author.description]);

    const onUpdate = (newDesc: string) => {
        console.log("update", newDesc);
        // TODO: 调 API 更新作者信息
    };

    const content = (
        <AuthorInfoEditShow
            author={author}
            onUpdate={onUpdate}
            setEditOpen={setEditOpen}
            descriptionState={descriptionState}
            setDescriptionState={setDescriptionState}
        />
    );

    if (mode === "modal") {
        return (
            <DialogContainer
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title="编辑作者信息"
            >
                {content}
            </DialogContainer>
        );
    }
    return content;
};

export const AuthorInfo = {
    Show: AuthorInfoShow,
    Container: AuthorInfoContainer,
} as const;

export const AuthorInfoEdit = {
    Show: AuthorInfoEditShow,
    Container: AuthorInfoEditContainer,
} as const;

// 也可以选择分别命名导出：
// export { AuthorInfoShow, AuthorInfoContainer, AuthorInfoEditShow, AuthorInfoEditContainer };
