"use client";

import { useState } from "react";
import { SettingsAccount } from "@/types";
import { Transaction } from "@solana/web3.js";
import { MessageCircle, Sparkles, X } from "lucide-react";
import ChatInput from "../ChatInput/ChatInput";

export function FloatingDashboardChat({
  settingsAccount,
  walletAddress,
  signTransaction,
  onRefresh,
  onError,
}: {
  settingsAccount: SettingsAccount;
  walletAddress: string;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] lg:left-65">
      <div className="relative flex w-full max-w-190 flex-col items-center">
        <div
          aria-hidden={!open}
          className={`pointer-events-auto relative w-full origin-bottom transition-[opacity,transform,max-height,visibility] duration-300 ease-out motion-reduce:transition-none ${
            open
              ? "visible max-h-180 translate-y-0 scale-100 opacity-100"
              : "invisible max-h-0 translate-y-3 scale-[0.98] opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Hover chat"
            className="absolute right-3 top-3 z-50 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-neutral-300 backdrop-blur transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X size={17} />
          </button>
          <ChatInput
            settingsAccount={settingsAccount}
            walletAddress={walletAddress}
            signTransaction={signTransaction}
            onRefresh={onRefresh}
            onError={onError}
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={`pointer-events-auto absolute bottom-0 group flex h-13 items-center gap-3 rounded-full border border-neutral-800 bg-[#1e1d1c] px-5 text-[14px] font-semibold text-white shadow-[0_16px_45px_rgba(0,0,0,0.22)] transition-[opacity,transform,background-color] duration-300 ease-out hover:bg-[#292725] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 motion-reduce:transition-none ${
            open
              ? "pointer-events-none translate-y-2 scale-95 opacity-0"
              : "translate-y-0 scale-100 opacity-100"
          }`}
        >
          <span className="relative flex size-8 items-center justify-center rounded-full bg-[#f4c96b] text-neutral-950 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none">
            <MessageCircle size={16} strokeWidth={2.2} />
            <span className="absolute -right-0.5 -top-0.5 flex size-3 items-center justify-center rounded-full border-2 border-[#1e1d1c] bg-emerald-400" />
          </span>
          <span>Talk to Hover</span>
        </button>
      </div>
    </div>
  );
}
