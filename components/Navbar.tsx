"use client";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import CustomWalletButton from "./customwalletbutton";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

function Navbar() {
  const { publicKey } = useWallet();
  const router = useRouter();

  useEffect(() => {
    // if (publicKey) {
    //     router.replace("/dashboard");
    // }
  }, [publicKey, router]);

  return (
    <nav className="w-full px-8 pt-5">
      <div className="flex h-14 items-center justify-between">
        {/* Left */}
        <div className="flex items-center">
          <div className="flex items-center gap-3 rounded-full bg-[#111111] px-5 py-2.5 text-sm font-medium tracking-tight text-white shadow-sm">
            <span>Hover</span>
          </div>
        </div>

        {/* Center / Links */}
        <div className="hidden items-center gap-1 ml-25 rounded-full bg-[#111111] px-2 py-2 text-sm text-white md:flex">
          <Link
            href="https://github.com/Squads-Protocol/smart-account-program/"
            target="link"
            className="flex items-center gap-2 rounded-full px-5 py-2 transition hover:bg-white/10"
          >
            Sqauds
            <FaGithub className="text-[14px] opacity-70" />
          </Link>

          <Link
            href="https://github.com/Squads-Protocol/smart-account-program/"
            target="link"
            className="flex items-center gap-2 rounded-full px-5 py-2 transition hover:bg-white/10"
          >
            Backend
            <FaGithub className="text-[14px] opacity-70" />
          </Link>

          <Link
            href="#"
            className="flex items-center gap-2 rounded-full px-5 py-2 transition hover:bg-white/10"
          >
            Frontend
            <FaGithub className="text-[14px] opacity-70" />
          </Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* <button className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800">
            Localhost
          </button> */}
          {/* <button className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800">
            
          </button> */}
          {/* <WalletMultiButton/> */}
          <CustomWalletButton />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
