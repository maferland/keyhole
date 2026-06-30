"use client";

import { useRef, useState } from "react";

interface CopyChipProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyChip({ text, label = "copy", className }: CopyChipProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex flex-none cursor-pointer items-center whitespace-nowrap rounded-md border border-[color-mix(in_srgb,var(--ac)_28%,transparent)] bg-[color-mix(in_srgb,var(--ac)_14%,transparent)] px-2.5 py-1 font-mono text-[11.5px] leading-none font-semibold text-ac transition-transform duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-px active:translate-y-0 ${className ?? ""}`}
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
