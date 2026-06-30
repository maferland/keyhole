"use client";

import { useState } from "react";
import { DEST_DATA, type Dest } from "@/lib/constants";
import { CopyChip } from "./CopyChip";

const DESTS: Dest[] = ["keychain", "file", "env"];

export function Demo() {
  const [currentDest, setCurrentDest] = useState<Dest>("keychain");
  const data = DEST_DATA[currentDest];

  return (
    <section className="animate-kh-up pt-[46px] pb-[30px]">
      <div className="mx-auto max-w-[1140px] px-7">
        <div className="mb-3 grid grid-cols-2 gap-[22px] max-[760px]:grid-cols-1 max-[760px]:gap-1">
          <div className="text-[11px] tracking-[0.16em] text-la uppercase">You — on localhost</div>
          <div className="text-[11px] tracking-[0.16em] text-la uppercase max-[760px]:hidden">Your agent — all it ever sees</div>
        </div>
        <div className="grid grid-cols-2 items-start gap-[22px] max-[760px]:grid-cols-1 max-[760px]:gap-4">
          <div className="group flex flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--ac)_24%,transparent)] bg-sf transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-[color-mix(in_srgb,var(--ac)_38%,transparent)] hover:shadow-[0_18px_50px_color-mix(in_srgb,var(--ac)_18%,transparent)]">
            <div className="flex items-center border-b border-b06 bg-tb px-3.5 py-2.5">
              <div className="flex flex-none gap-[5px]">
                <span className="h-[9px] w-[9px] rounded-full bg-[#2a2f2b]" />
                <span className="h-[9px] w-[9px] rounded-full bg-[#2a2f2b]" />
                <span className="h-[9px] w-[9px] rounded-full bg-[#2a2f2b]" />
              </div>
              <div className="flex-1 text-center text-[10.5px] text-fa">
                127.0.0.1:54213/s/<span className="text-[#3a443d]">8f3a2c…</span>
              </div>
              <div className="w-11" />
            </div>
            <div className="flex flex-col gap-3 px-5 pt-[22px] pb-[18px]">
              <div className="text-sm font-bold text-tx">
                Your agent needs a secret
              </div>
              <div className="inline-block self-start rounded-md border border-[color-mix(in_srgb,var(--ac)_24%,transparent)] bg-[color-mix(in_srgb,var(--ac)_8%,transparent)] px-2.5 py-[3px] text-[11.5px] text-so">
                OpenAI key for the ingest script
              </div>
              <div>
                <div className="mb-1.5 text-[11px] tracking-[0.1em] text-la uppercase">
                  OPENAI_API_KEY
                </div>
                <div className="flex items-center rounded-lg border border-[color-mix(in_srgb,var(--ac)_38%,transparent)] bg-si px-[13px] py-[11px] text-[13.5px] text-cl">
                  <span>sk-••••••••••••••••••</span>
                  <span className="animate-kh-blink ml-px inline-block h-[1.05em] w-2 flex-none rounded-[1px] bg-ac" />
                </div>
              </div>
              <div className="flex gap-2">
                {DESTS.map((dest) => {
                  const active = dest === currentDest;
                  return (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => setCurrentDest(dest)}
                      className={`flex-1 cursor-pointer rounded-md border px-1 py-[7px] text-center font-mono text-xs transition-[border-color,color,background] duration-150 ${
                        active
                          ? "border-[color-mix(in_srgb,var(--ac)_42%,transparent)] bg-[color-mix(in_srgb,var(--ac)_14%,transparent)] font-semibold text-ac"
                          : "border-white/8 bg-transparent text-ci hover:border-[color-mix(in_srgb,var(--ac)_40%,transparent)] hover:text-cl"
                      }`}
                    >
                      {dest}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="w-full cursor-pointer rounded-lg border-0 bg-ac py-[11px] font-mono text-[13.5px] leading-none font-bold text-[#06140a] transition-[box-shadow,filter,transform] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] hover:-translate-y-px hover:brightness-[1.07] hover:shadow-[0_12px_32px_color-mix(in_srgb,var(--ac)_42%,transparent)] active:translate-y-0"
              >
                Store →
              </button>
              <div className="text-center text-[10.5px] text-fa">
                localhost only · single-use · value never leaves this machine
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-b08 bg-si transition-[transform,box-shadow] duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_color-mix(in_srgb,var(--ac)_18%,transparent)]">
            <div className="flex items-center gap-2 border-b border-b07 px-4 py-2.5">
              <div className="h-2 w-2 flex-none rounded-full bg-ac" />
              <span className="text-[10.5px] text-fa">agent session</span>
            </div>
            <div className="flex flex-1 flex-col px-[18px] pt-[18px] pb-5 text-[11.5px] leading-[1.8]">
              <div className="text-mu">
                I need <span className="text-cl">OPENAI_API_KEY</span> to run the
                ingest script.
              </div>
              <div className="text-la">
                → opened keyhole on localhost, waiting…
              </div>
              <hr className="my-2.5 border-0 border-t border-t-b06" />
              <div className="font-bold text-ac">✓ stored</div>
              <div className="my-2 rounded-lg border border-b07 bg-[#0c120f] px-3 py-2.5 text-[11.5px] leading-[1.7]">
                <span className="text-so">{"{"}</span>
                <br />
                &nbsp;&nbsp;<span className="text-so">&quot;name&quot;:</span>{" "}
                <span className="text-cl">&quot;OPENAI_API_KEY&quot;</span>,
                <br />
                &nbsp;&nbsp;<span className="text-so">&quot;dest&quot;:</span>{" "}
                <span className="text-ac">{data.dest}</span>,
                <br />
                &nbsp;&nbsp;
                <span className="text-so">&quot;retrieve&quot;:</span>{" "}
                <span className="text-in">{data.retr}</span>
                <br />
                <span className="text-so">{"}"}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[11px] text-mu">
                  Got a reference — not the key.
                </span>
                <CopyChip text={data.retr} />
              </div>
              <div className="mt-auto pt-2.5 text-[10.5px] text-fa">
                {data.note}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center text-xs text-mu">
          ↑ pick a destination — the reference the agent gets updates live, the
          value never does
        </div>
      </div>
    </section>
  );
}
