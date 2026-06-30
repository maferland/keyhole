"use client";

import { useRef, useState } from "react";
import { INSTALL_CMDS } from "@/lib/constants";

export function NavCopyButton() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    navigator.clipboard.writeText(INSTALL_CMDS.claude).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-[7px] border border-[color-mix(in_srgb,var(--ac)_38%,transparent)] bg-transparent px-[15px] py-2 font-mono text-[12.5px] leading-none font-semibold text-ac transition-transform duration-150 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-px active:translate-y-0"
    >
      {copied ? "copied ✓" : "copy install"}
    </button>
  );
}
