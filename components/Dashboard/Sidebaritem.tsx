import { ReactNode } from "react";

export function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] font-medium transition-colors ${
        active
          ? "bg-white text-neutral-950"
          : "text-neutral-500 hover:bg-white/70 hover:text-neutral-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
