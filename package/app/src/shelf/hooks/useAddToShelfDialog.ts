import { useState } from "react";

export function useAddToShelfDialog() {
  const [open, setOpen] = useState(false);

  return {
    open,
    setOpen,
    handleOpen: () => setOpen(true),
    handleClose: () => setOpen(false),
  };
}
