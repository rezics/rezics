import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { useDialogStore } from "@/global/dialogStore";
import { t } from "@component/Text";

export namespace DialogReply {
    export type Show = {
        open: boolean;
        onClose: () => void;
        onSubmit?: () => void;
    };

    export const Show: React.FC<Show> = ({ open, onClose, onSubmit }) => {
        return (
            <Dialog open={open} onClose={onClose}>
                <DialogTitle>{t("common->reply")}</DialogTitle>
                <DialogContent>{/* Add your dialog content here */}</DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{t("common->cancel")}</Button>
                    <Button onClick={onSubmit || onClose} variant="contained" color="primary">
                        {t("common->submit")}
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
            dialog.setDialogVisible(false);
        };

        const handleSubmit = () => {
            onSubmit?.();
            handleClose();
        };

        return <Show open={true} onClose={handleClose} onSubmit={handleSubmit} />;
    };
}

export default DialogReply;
