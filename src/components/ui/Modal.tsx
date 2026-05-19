import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Full-screen sheet on mobile, large centered panel on desktop. */
  size?: "sm" | "lg";
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "sm",
  className,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-void/80 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fp-fade-in flex w-full flex-col border border-edge bg-panel shadow-2xl",
          "sm:rounded-xl",
          size === "lg"
            ? "sm:h-[min(80vh,720px)] sm:max-w-4xl"
            : "sm:max-w-md",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <header className="flex items-center justify-between border-b border-edge px-5 py-3.5">
            <h2 className="text-sm font-semibold tracking-wide text-ink">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-ink-faint transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
