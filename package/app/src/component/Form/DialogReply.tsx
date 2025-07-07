import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useDialogStore } from "@/global/dialogStore";
import { t } from "@component/Text";

const DialogReply: React.FC = () => {
    const dialog = useDialogStore();

    const handleClose = () => {
        dialog.setDialogVisible(false);
    };

    return (
        <Dialog open={true} onClose={handleClose}>
            <DialogTitle>{t("common->reply")}</DialogTitle>
            <DialogContent>{/* Add your dialog content here */}</DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{t("common->cancel")}</Button>
                <Button onClick={handleClose} variant="contained" color="primary">
                    {t("common->submit")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DialogReply;
