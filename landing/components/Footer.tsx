import { KeyholeMark } from "./KeyholeMark";

export function Footer() {
  return (
    <footer className="border-t border-b06 pt-[26px] pb-10">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between px-7 max-[760px]:flex-col max-[760px]:gap-2.5 max-[760px]:text-center">
        <div className="flex items-center gap-1.5">
          <KeyholeMark size={16} />
          <span className="text-sm font-extrabold tracking-[-0.01em] text-tx">
            keyhole<em className="not-italic text-ac">_</em>
          </span>
        </div>
        <div className="text-xs text-fa">
          MIT · runs on Node · secrets never leave your machine
        </div>
      </div>
    </footer>
  );
}
