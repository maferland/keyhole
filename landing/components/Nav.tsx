import { KeyholeMark } from "./KeyholeMark";
import { NavCopyButton } from "./NavCopyButton";

const LINKS = [
  { href: "#how-it-works", label: "how it works" },
  { href: "#destinations", label: "destinations" },
  { href: "#security", label: "security" },
  { href: "https://github.com/maferland/keyhole", label: "github" },
];

export function Nav() {
  return (
    <nav className="animate-kh-up border-b border-b06">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between px-7 py-6">
        <div className="flex items-center gap-2">
          <KeyholeMark />
          <span className="text-lg font-extrabold tracking-[-0.01em] text-tx">
            keyhole<em className="not-italic text-ac">_</em>
          </span>
        </div>
        <div className="flex items-center gap-7">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] text-di transition-colors duration-150 hover:text-tx max-[760px]:hidden"
            >
              {link.label}
            </a>
          ))}
          <NavCopyButton />
        </div>
      </div>
    </nav>
  );
}
