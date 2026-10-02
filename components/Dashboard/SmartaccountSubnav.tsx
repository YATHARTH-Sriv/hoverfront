export function SmartAccountSubnav({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-full items-center rounded-lg px-2 text-left text-[12.5px] font-medium transition-colors ${
        active
          ? "bg-white text-neutral-950"
          : "text-neutral-500 hover:bg-white/70 hover:text-neutral-800"
      }`}
    >
      {label}
    </button>
  );
}
