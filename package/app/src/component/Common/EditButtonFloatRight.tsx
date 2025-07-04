import { Edit } from "@mui/icons-material";
import { Button } from "@mui/material";

export function EditButtonFloatRight() {
    return (
        <div className="flex-1 justify-end">
            <Button variant="text" startIcon={<Edit />} className="float-right">
                编辑
            </Button>
        </div>
    );
}