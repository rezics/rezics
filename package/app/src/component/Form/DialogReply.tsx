import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

const DialogReply: React.FC = () => {
    const dialog = useDialogStore();

    const handleClose = () => {
        dialog.setDialogVisible(false);
    };

    return (
        <Dialog open={true} onClose={handleClose}>
            <DialogTitle>Reply</DialogTitle>
            <DialogContent>{/* Add your dialog content here */}</DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={handleClose} variant="contained" color="primary">
                    Submit
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DialogReply;
