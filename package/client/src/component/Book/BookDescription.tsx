import { Button, Typography } from "@mui/material";
import { Box } from "@mui/material";
import { AccentBarWithText } from "@component/Common/AccentBar.tsx";
import { EditButtonFloatRight } from "@component/Common/EditButtonFloatRight.tsx";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import DialogContainer from "../Common/DialogContainer.tsx";
import EasyEditor from "@component/Form/EasyEditor.tsx";

export namespace BookDescription {
	export type Show = {
		description: string;
		onEdit?: () => void;
		showEditButton?: boolean;
		editOpen?: boolean;
		setEditOpen?: (open: boolean) => void;
	};

	export const Show: React.FC<Show> = (
		{ description, onEdit, showEditButton = true, editOpen, setEditOpen },
	) => {
		let { t } = useTranslation();
		return (
			<div>
				<Box>
					<div className="flex mb-4">
						<AccentBarWithText.Show text={t("book.description")} />
						{showEditButton && (
							<EditButtonFloatRight.Show onClick={onEdit} />
						)}
					</div>
					<Typography
						variant="body1"
						className="whitespace-pre-line"
					>
						{description}
					</Typography>
				</Box>
				<BookDescriptionEdit.Container
					description={description}
					editOpen={editOpen ?? false}
					setEditOpen={setEditOpen}
					mode="modal"
				/>
			</div>
		);
	};

	export type Container = {
		description: string;
	};

	export const Container: React.FC<Container> = ({ description }) => {
		const [editOpen, setEditOpen] = useState(false);
		const handleEdit = () => {
			setEditOpen(true);
		};

		return (
			<Show
				description={description}
				onEdit={handleEdit}
				editOpen={editOpen}
				setEditOpen={setEditOpen}
			/>
		);
	};
}

export namespace BookDescriptionEdit {
	export type ShowProps = {
		description: string;
		onUpdate: (description: string) => void;
		setEditOpen: (open: boolean) => void;
		descriptionState: string;
		setDescriptionState: React.Dispatch<React.SetStateAction<string>>;
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
		description: string;
		editOpen: boolean;
		// setEditOpen: (open: boolean) => void;
		setEditOpen: any;
		mode?: "modal" | "inline"; // 'modal' wraps with Dialog, 'inline' renders directly
	};

	export const Container: React.FC<ContainerProps> = (
		{ description, editOpen, setEditOpen, mode = "inline" },
	) => {
		const [descriptionState, setDescriptionState] = useState(description);

		useEffect(() => {
			setDescriptionState(description);
		}, [description]);

		const onUpdate = (newDesc: string) => {
			console.log("update", newDesc);
		};

		const content = (
			<Show
				description={description}
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
					title="编辑书籍描述"
				>
					{content}
				</DialogContainer>
			);
		}

		return content;
	};
}
