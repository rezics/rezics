import { Avatar, Box, Typography } from "@mui/material";
import { Author } from "contract/schema";
import { useTranslation } from "react-i18next";
import { AccentBarWithText } from "@component/Common/AccentBar.tsx";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight.tsx";
import { useEffect, useState } from "react";
import EasyEditor from "@component/Form/EasyEditor.tsx";
import { Button } from "@mui/material";
import DialogContainer from "../Common/DialogContainer.tsx";

export namespace AuthorInfo {
	export type Show = {
		author: Author;
		onEdit?: () => void;
		showEditButton?: boolean;
		editOpen?: boolean;
		setEditOpen?: (open: boolean) => void;
	};

	export const Show: React.FC<Show> = (
		{ author, onEdit, showEditButton = true, editOpen, setEditOpen },
	) => {
		let { t } = useTranslation();
		return (
			<div>
				<Box>
					<div className="flex mb-4">
						<AccentBarWithText.Show
							text={t("book.authorInfo") + " " + author?.name}
						/>
						{showEditButton && (
							<EditButtonFloatRight.Show onClick={onEdit} />
						)}
					</div>
					<div className="whitespace-pre-line">
						<Box>
							<Box className="mb-4 mt-2 flex">
								{/* 左侧图片区域 */}
								<div className="w-1/4 flex justify-center items-center">
									<img
										src={author.avatar || ""}
										className="max-w-full max-h-full object-contain"
										alt="avatar"
									/>
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
					setEditOpen={setEditOpen}
					mode="modal"
				/>
			</div>
		);
	};

	export type Container = {
		author: Author;
	};

	export const Container: React.FC<Container> = ({ author }) => {
		const [editOpen, setEditOpen] = useState(false);
		const handleEdit = () => {
			setEditOpen(true);
		};

		return (
			<Show
				author={author}
				onEdit={handleEdit}
				editOpen={editOpen}
				setEditOpen={setEditOpen}
			/>
		);
	};
}

export namespace AuthorInfoEdit {
	export type ShowProps = {
		author: Author;
		onUpdate: (description: string) => void;
		setEditOpen: (open: boolean) => void;
		descriptionState: any;
		setDescriptionState: any;
	};

	export const Show: React.FC<ShowProps> = (
		{ onUpdate, setEditOpen, descriptionState, setDescriptionState },
	) => {
		const handleUpdate = () => {
			onUpdate(descriptionState);
			setEditOpen(false);
		};

		return (
			<div>
				<EasyEditor
					value={descriptionState}
					onChange={setDescriptionState}
				/>
				<div className="w-full">
					<div className="w-1/2 float-right">
						<Button
							onClick={handleUpdate}
							className="w-full"
						>
							提交
						</Button>
					</div>
				</div>
			</div>
		);
	};

	export type ContainerProps = {
		author: Author;
		editOpen: boolean;
		// setEditOpen: (open: boolean) => void;
		setEditOpen: any;
		mode?: "modal" | "inline"; // 'modal' wraps with Dialog, 'inline' renders directly
	};

	export const Container: React.FC<ContainerProps> = (
		{ author, editOpen, setEditOpen, mode = "inline" },
	) => {
		const [descriptionState, setDescriptionState] = useState(
			author.description,
		);

		useEffect(() => {
			setDescriptionState(author.description);
		}, [author.description]);

		const onUpdate = (newDesc: string) => {
			console.log("update", newDesc);
		};

		const content = (
			<Show
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
}
