"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Host_Grotesk } from "next/font/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tooltip } from "react-tooltip";

const grotesk = Host_Grotesk({
  subsets: ["latin"],
  weight: "400",
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function Hero() {
  const { publicKey } = useWallet();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const handleclick = async () => {
    if (!publicKey || checking) return;
    setChecking(true);
    try {
      const walletAddress = publicKey.toBase58();
      const response = await fetch(
        `${API_BASE}/dashboard?walletAddress=${encodeURIComponent(walletAddress)}&refresh=false`,
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.settings) && data.settings.length > 0) {
        router.push("/dashboard");
      } else {
        router.push("/onboard");
      }
    } catch {
      router.push("/dashboard");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="w-full px-6 pt-20 md:pt-24">
      <div className="mx-auto max-w-6xl">
        {/* Eyebrow */}
        <div
          className={`${grotesk.className} text-black text-[88px] mb-8 flex justify-center gap-5  tracking-[-0.03em]  md:text-[26px]`}
        >
          <span>Manage.</span>
          <span>Pay.</span>
          <span>Invest.</span>
        </div>

        {/* Main heading */}
        <h1
          className={`${grotesk.className} text-black flex justify-center text-center text-[4rem] font-semibold leading-[0.92] tracking-[-0.06em] sm:text-[4.5rem] md:text-[5.2rem] lg:text-[5.5rem]`}
        >
          <span>Finance</span>

          <span className="mx-3 ">Should be</span>

          <span>easy</span>
        </h1>

        {/* <button className="flex  items-center justify-center">Get Started</button> */}
      </div>
      <div className=" flex items-center justify-center mt-6 w-full h-20 ">
        {publicKey ? (
          <button
            onClick={handleclick}
            disabled={checking}
            className="flex cursor-pointer bg-black text-white rounded-xl m-2 p-3  items-center justify-center disabled:cursor-wait disabled:opacity-60"
          >
            {checking ? "Opening..." : "Get Started"}
          </button>
        ) : (
          <button
            id="getstarted-button"
            onClick={handleclick}
            disabled={!publicKey}
            className="flex cursor-pointer bg-gray-500 text-white rounded-xl m-2 p-3  items-center justify-center"
          >
            Get Started
          </button>
        )}
      </div>
      <Tooltip
        anchorSelect="#getstarted-button"
        content="Connect your wallet"
        place="bottom"
        style={{
          backgroundColor: "#000",
          color: "#fff",
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "3px 6px",
          fontSize: "13px",
          fontWeight: "500",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
        }}
      />
    </section>
  );
}

export default Hero;
