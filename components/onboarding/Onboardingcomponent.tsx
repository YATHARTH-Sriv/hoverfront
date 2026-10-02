"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronLeft, Loader2, Plus } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type WorkspaceType = "BUSINESS" | "INDIVIDUAL";

type BuildCreateSettingsResponse = {
  walletAddress: string;
  name: string;
  email?: string;
  threshold: number;
  timeLock: number;
  settingsPda: string;
  transactionBase64: string;
};

type SendTransactionResponse = {
  txSig: string;
};

type ChallengeResponse = {
  message: string;
};

const steps = ["Email", "Profile", "Workspace", "Settings", "Review"] as const;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  }
  return payload as T;
}

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}····${address.slice(-4)}`;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[13px] font-medium text-white/40">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-13 w-full rounded-[10px] border border-white/10 bg-white/2 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/25 hover:border-white/20 focus:border-[#2F81F7]/60 focus:bg-white/4 focus:ring-[3px] focus:ring-[#2F81F7]/15 ${
          mono ? "font-mono tracking-tight" : ""
        }`}
        style={{ height: "48px" }}
      />
    </label>
  );
}

export default function Onboardingcomponent() {
  const router = useRouter();
  const { publicKey, signMessage, signTransaction, connected } = useWallet();

  const [step, setStep] = useState(0);
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>("BUSINESS");
  const [email, setEmail] = useState("");
  const [personName, setPersonName] = useState("");
  const [designation, setDesignation] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [threshold, setThreshold] = useState("1");
  const [timeLock, setTimeLock] = useState("0");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  const walletAddress = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    async function routeExistingWorkspace() {
      try {
        const response = await fetch(
          `${API_BASE}/dashboard?walletAddress=${encodeURIComponent(walletAddress)}&refresh=false`,
        );
        const payload = await response.json().catch(() => ({}));
        if (
          !cancelled &&
          response.ok &&
          Array.isArray(payload.settings) &&
          payload.settings.length > 0
        ) {
          router.replace("/dashboard");
        }
      } catch {}
    }

    void routeExistingWorkspace();
    return () => {
      cancelled = true;
    };
  }, [router, walletAddress]);

  function validateStep() {
    if (step === 0 && !email.trim()) return "Enter your email.";
    if (step === 1 && !personName.trim()) return "Enter your name.";
    if (step === 2 && !workspaceName.trim()) return "Enter a workspace name.";
    if (step === 3) {
      const thresholdNumber = Number(threshold);
      const timeLockNumber = Number(timeLock);
      if (!Number.isInteger(thresholdNumber) || thresholdNumber < 1)
        return "Threshold must be at least 1.";
      if (!Number.isInteger(timeLockNumber) || timeLockNumber < 0)
        return "Timelock must be 0 or more.";
    }
    return "";
  }

  function handleNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (step < steps.length - 1) setStep((current) => current + 1);
  }

  async function completeOnboarding() {
    try {
      setError("");
      if (!connected || !publicKey || !signMessage || !signTransaction) {
        throw new Error("Connect a wallet that supports message and transaction signing.");
      }
      setBusy(true);

      setStage("Saving profile");
      const challenge = await apiRequest<ChallengeResponse>("/auth/challenge", {
        method: "POST",
        body: JSON.stringify({ walletAddress }),
      });
      const messageBytes = new TextEncoder().encode(challenge.message);
      const signature = await signMessage(messageBytes);
      await apiRequest("/auth/verify", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          message: challenge.message,
          signature: bytesToBase64(signature),
          name: personName,
          email,
          designation,
        }),
      });

      setStage("Preparing settings account");
      const built = await apiRequest<BuildCreateSettingsResponse>("/settings/build-create", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          email,
          name: workspaceName,
          workspaceType,
          threshold: Number(threshold),
          timeLock: Number(timeLock),
          signers: [],
        }),
      });

      setStage("Waiting for wallet approval");
      const transaction = Transaction.from(base64ToBytes(built.transactionBase64));
      const signed = await signTransaction(transaction);

      setStage("Creating settings account");
      const sent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signed.serialize()) }),
      });

      setStage("Syncing dashboard");
      await apiRequest("/settings/submitted", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          name: built.name,
          email: built.email ?? email,
          settingsPda: built.settingsPda,
          txSig: sent.txSig,
        }),
      });

      setStage("Complete");
      window.setTimeout(() => router.replace("/dashboard"), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
      setBusy(false);
      setStage("");
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#080808] px-6 text-white">
      {/* faint structural backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-150 flex-col justify-center py-12">
        {/* header / step tracker */}
        <div className="mb-8">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/35">
              Hover
            </span>
            <span className="font-mono text-[13px] tabular-nums text-white/30">
              {String(step + 1).padStart(2, "0")}
              <span className="text-white/15"> / {String(steps.length).padStart(2, "0")}</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {steps.map((label, index) => (
              <div key={label} className="flex-1">
                <div
                  className={`h-0.75 rounded-full transition-colors duration-300 ${
                    index <= step ? "bg-white" : "bg-white/10"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>

        <section
          key={step}
          className="motion-safe:animate-[onboarding-card_260ms_cubic-bezier(0.16,1,0.3,1)] rounded-2xl border border-white/8 bg-[#0C0C0D] p-7 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_60px_rgba(0,0,0,0.5)] md:p-9"
        >
          <div className="mb-9 flex items-start justify-between gap-6">
            <div>
              <p className="mb-2.5 font-mono text-[12px] uppercase tracking-[0.14em] text-white/35">
                {steps[step]}
              </p>
              <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white md:text-[36px]">
                {step === 0 && "Welcome to Hover"}
                {step === 1 && "Tell us who you are"}
                {step === 2 && "Set up your workspace"}
                {step === 3 && "Create your settings account"}
                {step === 4 && "Review and launch"}
              </h1>
              <p className="mt-3 max-w-md text-[15px] leading-6 text-white/45">
                {step === 0 && "Start with the email you want linked to this treasury workspace."}
                {step === 1 &&
                  "We will use this to personalize approvals, signers, and activity records."}
                {step === 2 &&
                  "Choose whether this treasury is for a company workspace or an individual setup."}
                {step === 3 && "These values become the first on-chain Squads settings account."}
                {step === 4 &&
                  "Phantom will sign the transaction, then we save the indexed details to your dashboard."}
              </p>
            </div>
          </div>

          <form onSubmit={handleNext} className="space-y-5">
            {step === 0 && (
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                type="email"
              />
            )}

            {step === 1 && (
              <div className="space-y-4">
                <Field
                  label="Name"
                  value={personName}
                  onChange={setPersonName}
                  placeholder="Yatharth Srivastava"
                />
                <Field
                  label="Designation"
                  value={designation}
                  onChange={setDesignation}
                  placeholder="Founder, Finance Lead, Operator"
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-white/8 bg-white/2 p-1">
                  {(["BUSINESS", "INDIVIDUAL"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setWorkspaceType(type)}
                      className={`h-11 rounded-[7px] text-[14px] font-medium transition-colors ${
                        workspaceType === type
                          ? "bg-white text-black"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {type === "BUSINESS" ? "Business" : "Individual"}
                    </button>
                  ))}
                </div>
                <Field
                  label="Workspace name"
                  value={workspaceName}
                  onChange={setWorkspaceName}
                  placeholder="Apple Inc Treasury"
                />
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Threshold"
                  value={threshold}
                  onChange={setThreshold}
                  placeholder="1"
                  type="number"
                  mono
                />
                <Field
                  label="Timelock (seconds)"
                  value={timeLock}
                  onChange={setTimeLock}
                  placeholder="0"
                  type="number"
                  mono
                />
              </div>
            )}

            {step === 4 && (
              <div className="overflow-hidden rounded-[10px] border border-white/8">
                <ReviewRow
                  label="Wallet"
                  value={walletAddress ? truncateAddress(walletAddress) : "Not connected"}
                  mono
                />
                <ReviewRow label="Workspace" value={workspaceName || "—"} />
                <ReviewRow label="Email" value={email || "—"} />
                <ReviewRow
                  label="Profile"
                  value={`${personName || "—"}${designation ? ` · ${designation}` : ""}`}
                />
                <ReviewRow
                  label="Settings"
                  value={`${threshold}-of-1 signer · ${timeLock}s timelock`}
                  mono
                  last
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 rounded-[10px] border border-red-500/20 bg-red-500/6 px-4 py-3 text-[13px] leading-5 text-red-200/90">
                {error}
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-3 rounded-[10px] border border-white/8 bg-white/3 px-4 py-3 text-[13px] text-white/60">
                <Loader2 className="animate-spin text-white/40" size={15} />
                <span className="font-mono">{stage}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                disabled={step === 0 || busy}
                className="flex h-12 flex-[0_0_88px] items-center justify-center gap-1.5 rounded-[10px] border border-white/10 text-[14px] font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-12 flex-1 items-center justify-center rounded-[10px] bg-white text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={completeOnboarding}
                  disabled={busy}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-white text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}
                  Create treasury
                </button>
              )}
            </div>
          </form>
        </section>

        {/* wallet readout */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <span
            className={`size-1.5 rounded-full ${walletAddress ? "bg-[#2F81F7]" : "bg-white/20"}`}
          />
          <span className="font-mono text-[13px] text-white/35">
            {walletAddress
              ? truncateAddress(walletAddress)
              : "Connect your wallet from the landing page first"}
          </span>
        </div>
      </div>
    </main>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-5 bg-white/1.5 px-4 py-3 ${
        !last ? "border-b border-white/6" : ""
      }`}
    >
      <span className="text-[13px] text-white/40">{label}</span>
      <span
        className={`max-w-[65%] truncate text-[13px] font-medium text-white ${
          mono ? "font-mono tracking-tight" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
