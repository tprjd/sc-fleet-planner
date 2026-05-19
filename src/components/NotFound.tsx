import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";
import { Button } from "./ui/Button";

export function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Rocket size={40} className="text-ink-faint" />
      <h1 className="text-2xl font-bold">Lost in the verse</h1>
      <p className="max-w-sm text-sm text-ink-dim">
        That page drifted out of scanner range. Head back to the hangar.
      </p>
      <Link to="/">
        <Button>Return home</Button>
      </Link>
    </main>
  );
}
