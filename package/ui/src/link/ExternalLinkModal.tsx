import { Button } from "@/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/dialog";
import { closeExternal, useExternalLinkStore } from "./store";

export function ExternalLinkModal() {
  const { pendingHref, pendingHost } = useExternalLinkStore();
  const isOpen = pendingHref !== null;

  const handleContinue = () => {
    if (pendingHref) {
      window.open(pendingHref, "_blank", "noopener,noreferrer");
    }
    closeExternal();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeExternal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leaving rezics</DialogTitle>
          <DialogDescription>
            You are about to visit an external site:
          </DialogDescription>
        </DialogHeader>
        <p className="select-text text-center text-base font-medium">
          {pendingHost}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={closeExternal}>
            Cancel
          </Button>
          <Button onClick={handleContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
