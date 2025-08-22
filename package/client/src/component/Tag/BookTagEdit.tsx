import DialogContainer from "@component/Common/DialogContainer.tsx"; // Ensure this path is correct
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
	Alert,
	Button,
	Chip,
	IconButton,
	MenuItem,
	TextField,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import Menu from "@mui/material/Menu";
import React, { useEffect, useState } from "react";

export function TagEditAutocomplete() {
	const OrganizationList = [
		"Harem Heaven",
		"Science fiction enthusiast",
		"Fantasy lover",
		"Historical fiction lover",
		"Mystery lover",
		"Thriller lover",
		"Romance lover",
		"Western lover",
	];
	return (
		<Autocomplete
			disablePortal
			options={OrganizationList}
			renderInput={(params) => (
				<TextField {...params} label="Organization" />
			)}
			className="w-full"
		/>
	);
}

interface TagEditChipProps {
	label: string;
	onEdit: (label: string) => void;
	onDelete: (label: string) => void;
}

const TagEditChip = ({ label, onEdit, onDelete }: TagEditChipProps) => {
	const [anchorEl, setAnchorEl] = useState(null);
	const [openMenu, setOpenMenu] = useState(false);

	const handleClick = (event: any) => {
		setAnchorEl(event.currentTarget);
		setOpenMenu(true);
	};

	const handleClose = () => {
		setAnchorEl(null);
		setOpenMenu(false);
	};

	const handleEdit = () => {
		if (onEdit) onEdit(label);
		handleClose();
	};

	const handleDelete = () => {
		if (onDelete) onDelete(label);
		handleClose();
	};

	return (
		<div className="inline-flex items-center space-x-2">
			<Chip
				label={label}
				className="bg-gray-100 text-gray-700 border rounded-xl p-2 text-sm cursor-pointer"
				onClick={handleClick} // This makes the chip clickable
			/>
			<Menu
				anchorEl={anchorEl}
				open={openMenu}
				onClose={handleClose}
				PaperProps={{
					elevation: 3,
					sx: {
						"& .MuiMenuItem-root": {
							fontSize: "14px",
							padding: "8px 16px",
							color: "black",
						},
					},
				}}
			>
				<MenuItem onClick={handleEdit}>Edit</MenuItem>
				<MenuItem onClick={handleDelete}>Delete</MenuItem>
			</Menu>
		</div>
	);
};

interface EditSingleTagProps {
	label: string;
	onUpdate: (label: string) => void;
	setOnTagEdit: (label: boolean) => void;
}

function EditSingleTag({ label, onUpdate, setOnTagEdit }: EditSingleTagProps) {
	return (
		<div className="mt-6">
			<div className="flex justify-between">
				<Button
					variant="outlined"
					color="primary"
					onClick={() => setOnTagEdit(false)}
				>
					Back
				</Button>
				<div className="w-full !ml-4 items-center py-1 font-bold">
					{label}
				</div>
				<Button
					variant="contained"
					color="primary"
					onClick={() => setOnTagEdit(false)}
				>
					Update
				</Button>
			</div>
			<div className="mt-4">
				<TextField
					label="name"
					value={label}
					onChange={(e) => onUpdate(e.target.value)}
				/>
			</div>
		</div>
	);
}

export namespace BookTagEdit {
	export type ShowProps = {
		tagGroupObject: TagGroup;
		onUpdate: (tagGroupObject: TagGroup) => void;
	};

	export const Show: React.FC<ShowProps> = ({ tagGroupObject, onUpdate }) => {
		const handleUpdate = () => {
			// Update logic goes here
			onUpdate(tagGroupObject);
		};

		const [onTagEdit, setOnTagEdit] = useState<boolean | null>(null);

		const handleTagEdit = (label: string) => {
			setOnTagEdit(true);
		};

		return (
			<div>
				<Alert severity="info" className="mb-4">
					单机Tag以编辑,
					你只会搜索到你订阅的组织，如果想要编辑某个组织的标签，请去[这里]管理组织订阅
				</Alert>
				<div className="flex justify-between">
					<div className="w-full">
						<TagEditAutocomplete />
					</div>
					<Button
						variant="contained"
						color="primary"
						onClick={handleUpdate}
						className="w-1/4 !ml-4"
					>
						Update
					</Button>
				</div>
				{
					/* TODO
                 * 根据 Organization and Item(BookId) 获取 TagGroup
                 * 编辑特定 TagGroup 的 Tags
                 */
				}
				{onTagEdit
					? (
						<EditSingleTag
							label={"tag 1"}
							onUpdate={() => {}}
							setOnTagEdit={setOnTagEdit}
						/>
					)
					: (
						<div className="flex flex-wrap gap-2 mt-6">
							{tagGroupObject.tags.map((tag) => (
								<TagEditChip
									key={tag}
									label={tag}
									onEdit={handleTagEdit}
									onDelete={() => {}}
								/>
							))}
						</div>
					)}
			</div>
		);
	};

	export type ContainerProps = {
		tagObjects: TagGroup[];
		updateTagObjects: (tagObjects: TagGroup[]) => void;
		editOpen: boolean;
		setEditOpen: (open: boolean) => void;
		mode?: "modal" | "inline";
	};

	export const Container: React.FC<ContainerProps> = ({
		tagObjects,
		updateTagObjects,
		editOpen,
		setEditOpen,
		mode = "inline",
	}) => {
		const [editedTagGroupObject, setEditedTagGroupObject] = useState<any>();

		useEffect(() => {
			// setEditedTagObjects(tagObjects);
			setEditedTagGroupObject({
				id: "1",
				name: "Tag Group 1",
				tags: ["Tag 1", "Tag 2", "Tag 3"],
			});
		}, [tagObjects]);

		const handleTagUpdate = (updatedTagGroupObject: TagGroup) => {
			setEditedTagGroupObject(updatedTagGroupObject);
			// updateTagObjects(updatedTagGroupObject);
			console.log(updatedTagGroupObject);
		};

		const content = (
			<Show
				tagGroupObject={editedTagGroupObject || {
					id: "1",
					name: "Tag Group 1",
					tags: [],
				}}
				onUpdate={handleTagUpdate}
			/>
		);

		if (mode === "modal") {
			return (
				<DialogContainer
					open={editOpen}
					onClose={() => setEditOpen(false)}
					title="Edit Book Tags"
				>
					<div className="min-h-[500px]">{content}</div>
				</DialogContainer>
			);
		}

		return content;
	};
}
