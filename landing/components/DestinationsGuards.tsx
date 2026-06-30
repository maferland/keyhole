const DESTINATIONS = [
  { key: "keychain", val: "encrypted at rest · macOS" },
  { key: "file:/path", val: "raw value · mode 0600" },
  { key: "env:/path", val: "NAME=value lines · 0600" },
];

const GUARDS = [
  { main: "binds 127.0.0.1 only", small: "Host must be loopback" },
  { main: "random URL token per run", small: "all else 404s" },
  { main: "rejects cross-origin POSTs", small: null },
  { main: "single-use", small: "stores once, then 409s" },
];

export function DestinationsGuards() {
  return (
    <section id="destinations" className="animate-kh-up pt-10 pb-10">
      <div className="mx-auto max-w-[1140px] px-7">
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-b07 max-[760px]:grid-cols-1">
          <div className="border-r border-b07 px-[22px] pt-[22px] pb-6 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-b-b07">
            <div className="mb-4 text-[11px] tracking-[0.16em] text-ac uppercase">
              Destinations
            </div>
            {DESTINATIONS.map((row, i) => (
              <div
                key={row.key}
                className={`flex gap-3 py-2 text-[12.5px] leading-[1.5] ${
                  i < DESTINATIONS.length - 1 ? "border-b border-b06" : ""
                }`}
              >
                <span className="min-w-[100px] flex-none font-medium whitespace-nowrap text-ac">
                  {row.key}
                </span>
                <span className="text-mu">{row.val}</span>
              </div>
            ))}
          </div>
          <div id="security" className="px-[22px] pt-[22px] pb-6">
            <div className="mb-4 text-[11px] tracking-[0.16em] text-ac uppercase">
              Guards
            </div>
            {GUARDS.map((guard, i) => (
              <div
                key={guard.main}
                className={`flex gap-3 py-2 text-[12.5px] leading-[1.5] ${
                  i < GUARDS.length - 1 ? "border-b border-b06" : ""
                }`}
              >
                <span className="flex-none text-ac">✓</span>
                <span className="text-mu">
                  {guard.main}
                  {guard.small && (
                    <small className="block text-[11px] text-fa">
                      {guard.small}
                    </small>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
