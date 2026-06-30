const STEPS = [
  {
    num: "01",
    title: "Agent asks",
    body: (
      <>
        It runs <code>keyhole NAME</code> instead of asking you to paste a key
        into the chat.
      </>
    ),
  },
  {
    num: "02",
    title: "You type it",
    body: "A form opens on a random localhost URL. The value goes straight to your chosen store.",
  },
  {
    num: "03",
    title: "Agent gets a ref",
    body: "It receives a one-line retrieve command — and resolves the key only at runtime.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="animate-kh-up border-t border-b06 pt-[62px] pb-10"
    >
      <div className="mx-auto max-w-[1140px] px-7">
        <div className="mb-8 text-[11px] font-normal tracking-[0.24em] text-ac uppercase">
          How it works
        </div>
        <div className="grid grid-cols-3 gap-[30px] max-[760px]:grid-cols-1 max-[760px]:gap-5">
          {STEPS.map((step) => (
            <div key={step.num}>
              <div className="mb-3 text-[13px] font-normal text-ac">
                {step.num}
              </div>
              <div className="mb-2 text-base font-bold text-tx">
                {step.title}
              </div>
              <div className="text-[13px] leading-[1.65] text-di">
                {step.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
