import { useDialogStore } from "@/global/dialogStore";
import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
} from "@mui/material";
import React from "react";
//  ;

export namespace DialogReply {
	export type Show = {
		open: boolean;
		onClose: () => void;
		onSubmit?: () => void;
	};

	export const Show: React.FC<Show> = ({ open, onClose, onSubmit }) => {
		return (
			<Dialog open={open} onClose={onClose}>
				<DialogTitle>{/* Add your dialog content here */}</DialogTitle>
				<DialogContent>
					{/* Add your dialog content here */}
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose}>
						{/* Add your dialog content here */}
					</Button>
					<Button
						onClick={onSubmit || onClose}
						variant="contained"
						color="primary"
					>
						{/* Add your dialog content here */}
					</Button>
				</DialogActions>
			</Dialog>
		);
	};

	export type Container = {
		onSubmit?: () => void;
	};

	export const Container: React.FC<Container> = ({ onSubmit }) => {
		const dialog = useDialogStore();

		const handleClose = () => {
			// dialog.setDialogVisible(false);
		};

		const handleSubmit = () => {
			onSubmit?.();
			handleClose();
		};

		return (
			<Show open={true} onClose={handleClose} onSubmit={handleSubmit} />
		);
	};
}

export default DialogReply;
