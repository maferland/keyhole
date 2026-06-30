"use client";

import { INSTALL_CMDS } from "@/lib/constants";
import { CopyChip } from "./CopyChip";

export function CTA() {
  return (
    <section className="animate-kh-up border-t border-b06 pt-[84px] pb-[70px] text-center max-[760px]:pt-[60px] max-[760px]:pb-[56px]">
      <div className="mx-auto max-w-[1140px] px-7">
        <h2 className="mb-9 text-[38px] leading-[1.12] font-extrabold tracking-[-0.02em] whitespace-pre-line text-tx max-[760px]:text-[27px]">
          {"Hand over the key.\nNot the keys to the kingdom."}
        </h2>
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-[10px] border border-b08 bg-sp py-3.5 pr-3.5 pl-[18px] max-[760px]:flex-wrap max-[760px]:justify-center">
            <span className="flex-none text-sm text-ac">$</span>
            <span className="text-sm text-cl max-[760px]:break-all">
              {INSTALL_CMDS.claude}
            </span>
            <CopyChip text={INSTALL_CMDS.claude} className="max-[760px]:mt-1" />
          </div>
        </div>
      </div>
    </section>
  );
}
