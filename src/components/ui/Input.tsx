import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-edge bg-void px-3 text-sm text-ink",
        "placeholder:text-ink-faint transition-colors",
        "focus:border-accent focus:outline-none",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
