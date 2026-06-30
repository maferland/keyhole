export function Comparison() {
  return (
    <section className="animate-kh-up pt-[54px] pb-[30px]">
      <div className="mx-auto max-w-[1140px] px-7">
        <div className="grid grid-cols-2 gap-[22px] max-[760px]:grid-cols-1 max-[760px]:gap-4">
          <div className="rounded-xl border border-b07 bg-sw px-5 py-[22px] transition-[transform,box-shadow] duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_color-mix(in_srgb,var(--ac)_18%,transparent)]">
            <div className="mb-3.5 text-[11px] font-normal tracking-[0.16em] text-da uppercase">
              The old way
            </div>
            <div className="mb-3.5 rounded-lg border border-b06 bg-sc px-3 py-2.5 text-xs leading-[1.65]">
              <div>
                you: <span className="text-da">sk-live-1a2b3c…</span>
              </div>
              <div className="mt-1.5 text-[10.5px] text-la">
                ↳ now in the context window, transcript, and every log line
              </div>
            </div>
            <div className="text-[13px] leading-[1.6] text-mu">
              Once it&apos;s in the chat, you can&apos;t get it back out. Rotate
              the key and move on.
            </div>
          </div>
          <div className="rounded-xl border border-b07 bg-sk px-5 py-[22px] transition-[transform,box-shadow] duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_color-mix(in_srgb,var(--ac)_18%,transparent)]">
            <div className="mb-3.5 text-[11px] font-normal tracking-[0.16em] text-ac uppercase">
              The keyhole way
            </div>
            <div className="mb-3.5 rounded-lg border border-b06 bg-sc px-3 py-2.5 text-xs leading-[1.65]">
              <div>
                agent: <span className="text-ac">keychain:OPENAI_API_KEY</span>
              </div>
              <div className="mt-1.5 text-[10.5px] text-la">
                ↳ a reference, expanded only at runtime — value never touched
              </div>
            </div>
            <div className="text-[13px] leading-[1.6] text-mu">
              The secret lands in your Keychain. The agent never holds it — just
              a pointer to it.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
