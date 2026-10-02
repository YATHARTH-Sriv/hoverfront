import { SmartAccount } from "@/types";
import { formatSol } from "./helpers";
import { Check, Copy } from "lucide-react";

export function SmartAccountCard({
  account,
  selected,
  copied,
  onSelect,
  onCopy,
}: {
  account: SmartAccount;
  selected: boolean;
  copied: string;
  onSelect: () => void;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <div
      className={`group min-h-33 rounded-2xl border p-4 text-left transition-all ${
        selected
          ? "border-neutral-950 text-white shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
          : "border-neutral-100 bg-gray-950 text-white hover:border-neutral-200 hover:shadow-[0_14px_40px_rgba(0,0,0,0.06)]"
      }`}
    >
      <button type="button" onClick={onSelect} className="block w-full text-left">
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold tracking-[-0.02em]">
              {account.name}
            </span>
            <span className={`mt-1 block font-mono text-[12px] text-white`}>
              account index #{account.accountIndex}
            </span>
          </span>
          <span className="shrink-0 text-[15px] font-semibold tracking-[-0.02em]">
            {formatSol(account.balanceLamports)}
          </span>
        </span>
      </button>

      <span
        className={`mt-7 block text-[12.5px] font-medium ${selected ? "text-white/45" : "text-neutral-400"}`}
      >
        Smart account PDA
      </span>
      <span className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/85">
          {account.pda}
        </span>
        <button
          type="button"
          onClick={() => void onCopy(account.pda)}
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            selected
              ? "text-white/55 hover:bg-white/10 hover:text-white"
              : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-950"
          }`}
          aria-label={`Copy ${account.name} smart account PDA`}
        >
          {copied === account.pda ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </span>
    </div>
  );
}
