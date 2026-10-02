"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Check, ChevronDown, Copy, LogOut, Wallet } from "lucide-react";

function shortAddress(address: string) {
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

export default function CustomWalletButton() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-medium tracking-tight text-white shadow-sm transition hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Wallet size={17} strokeWidth={1.8} />
        {connecting ? "Connecting" : "Select Wallet"}
      </button>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-medium tracking-tight text-white shadow-sm transition hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        <Wallet size={17} strokeWidth={1.8} />
        {shortAddress(address)}
        <ChevronDown
          size={16}
          strokeWidth={1.8}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-13 z-50 w-52 overflow-hidden rounded-[18px] border border-[#3c3b3a] bg-[#211f1e] p-1.5 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 700);
            }}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm text-[#dedddb] transition hover:bg-[#2b2928] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
            {copied ? "Copied" : "Copy address"}
          </button>

          <button
            type="button"
            onClick={() => {
              setVisible(true);
              setOpen(false);
            }}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm text-[#dedddb] transition hover:bg-[#2b2928] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Wallet size={17} />
            Change wallet
          </button>

          <button
            type="button"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-left text-sm text-[#ffb4a8] transition hover:bg-[#3a2421] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut size={17} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
