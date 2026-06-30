export function KeyholeMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="relative block flex-none rounded-full border-2 border-ac"
      style={{ width: size, height: size }}
    >
      <span className="absolute bottom-0.5 left-1/2 h-[7px] w-[3px] -translate-x-1/2 rounded-b-[2px] bg-ac" />
    </span>
  );
}
