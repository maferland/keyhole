"use client";

import { useState } from "react";
import { INSTALL_CMDS, INSTALL_CAPTIONS, type InstallTab } from "@/lib/constants";
import { CopyChip } from "./CopyChip";

export function CTA() {
  const [activeTab, setActiveTab] = useState<InstallTab>("claude");

  return (
    <section className="animate-kh-up border-t border-b06 pt-[84px] pb-[70px] text-center max-[760px]:pt-[60px] max-[760px]:pb-[56px]">
      <div className="mx-auto max-w-[1140px] px-7">
        <h2 className="mb-9 text-[38px] leading-[1.12] font-extrabold tracking-[-0.02em] whitespace-pre-line text-tx max-[760px]:text-[27px]">
          {"Hand over the key.\nNot the keys to the kingdom."}
        </h2>
        <div className="mb-3.5">
          <div className="inline-flex overflow-hidden rounded-lg border border-b08">
            <button
              type="button"
              onClick={() => setActiveTab("claude")}
              className={`cursor-pointer border-0 px-3.5 py-1.5 font-mono text-[11.5px] leading-none font-medium transition-colors duration-150 ${
                activeTab === "claude"
                  ? "bg-[color-mix(in_srgb,var(--ac)_12%,transparent)] text-ac"
                  : "bg-transparent text-di"
              }`}
            >
              Claude
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("npm")}
              className={`cursor-pointer border-0 border-l border-l-b08 px-3.5 py-1.5 font-mono text-[11.5px] leading-none font-medium transition-colors duration-150 ${
                activeTab === "npm"
                  ? "bg-[color-mix(in_srgb,var(--ac)_12%,transparent)] text-ac"
                  : "bg-transparent text-di"
              }`}
            >
              CLI
            </button>
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-[10px] border border-b08 bg-sp py-3.5 pr-3.5 pl-[18px] max-[760px]:flex-wrap max-[760px]:justify-center">
            <span className="flex-none text-sm text-ac">$</span>
            <span className="text-sm text-cl max-[760px]:break-all">
              {INSTALL_CMDS[activeTab]}
            </span>
            <CopyChip text={INSTALL_CMDS[activeTab]} className="max-[760px]:mt-1" />
          </div>
        </div>
        <div className="mt-3.5 text-xs tracking-[0.02em] text-fa">
          {INSTALL_CAPTIONS[activeTab]}
        </div>
      </div>
    </section>
  );
}
