import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="px-5 py-4 text-sm text-ink-dim">{body}</div>
      <footer className="flex justify-end gap-2 border-t border-edge px-5 py-3.5">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </footer>
    </Modal>
  );
}
