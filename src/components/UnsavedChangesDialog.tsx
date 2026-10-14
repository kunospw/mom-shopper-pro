import type { Blocker } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  return (
    <AlertDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open && blocker.state === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Perubahan belum disimpan</AlertDialogTitle>
          <AlertDialogDescription>
            Anda dapat melanjutkan mengisi atau meninggalkan halaman tanpa
            menyimpan perubahan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={(event) => {
              event.preventDefault();
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            Lanjutkan mengisi
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Tinggalkan tanpa menyimpan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
