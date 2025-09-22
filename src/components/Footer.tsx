"use client";

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-3 text-[11px] text-muted-foreground">
        <span className="opacity-80">
          © {new Date().getFullYear()} — Fait par{" "}
          <span className="font-medium text-foreground">Timothy Roch</span>
        </span>
        <nav className="flex items-center gap-3">
          <a
            href="mailto:timothyroch@gmail.com"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            timothyroch@gmail.com
          </a>
          <span aria-hidden>•</span>
          <a
            href="tel:+15148808354"
            className="hover:text-foreground underline-offset-2 hover:underline"
          >
            514-880-8354
          </a>
        </nav>
      </div>
    </footer>
  );
}
