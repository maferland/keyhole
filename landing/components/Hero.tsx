"use client";

import { useState } from "react";
import {
  INSTALL_CMDS,
  INSTALL_CAPTIONS,
  type InstallTab,
} from "@/lib/constants";
import { CopyChip } from "./CopyChip";

export function Hero() {
  const [activeTab, setActiveTab] = useState<InstallTab>("claude");

  return (
    <section className="animate-kh-up relative overflow-hidden pt-[84px] pb-[30px] text-center">
      <div
        aria-hidden
        className="animate-kh-glow pointer-events-none absolute top-[-20%] left-1/2 h-[400px] w-[600px] -translate-x-1/2 opacity-30 blur-[60px]"
        style={{
          background:
            "radial-gradient(ellipse, color-mix(in srgb, var(--ac) 18%, transparent), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-[1140px] px-7">
        <div className="mb-[22px] text-xs font-normal tracking-[0.24em] text-ac uppercase">
          CLI · ANY AGENT
        </div>
        <h1 className="mx-auto mb-6 max-w-[780px] text-[62px] leading-[1.04] font-extrabold tracking-[-0.025em] text-tx max-[760px]:text-[33px] max-[760px]:leading-[1.08]">
          Stop pasting secrets into your agent.
        </h1>
        <p className="mx-auto mb-9 max-w-[580px] text-base leading-[1.7] text-mu max-[760px]:text-[15px]">
          Your agent needs an API key. Normally you&apos;d paste it into the
          chat — where it lands in the context window, transcript, and every
          log. keyhole hands it a{" "}
          <em className="not-italic text-ac">reference</em> instead.
        </p>

        <div>
          <div className="mb-3.5 inline-flex overflow-hidden rounded-lg border border-b08">
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
          <div className="mb-3.5 inline-flex items-center gap-2.5 rounded-[10px] border border-b08 bg-sp py-3.5 pr-3.5 pl-[18px] max-[760px]:flex-wrap max-[760px]:justify-center">
            <span className="flex-none text-sm text-ac">$</span>
            <span className="text-sm text-cl max-[760px]:break-all">
              {INSTALL_CMDS[activeTab]}
            </span>
            <CopyChip
              text={INSTALL_CMDS[activeTab]}
              className="max-[760px]:mt-1"
            />
          </div>
        </div>
        <div className="text-xs tracking-[0.02em] text-fa">
          {INSTALL_CAPTIONS[activeTab]}
        </div>
      </div>
    </section>
  );
}
