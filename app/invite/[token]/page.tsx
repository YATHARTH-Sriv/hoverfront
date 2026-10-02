"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import CustomWalletButton from "@/components/customwalletbutton";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8787";

type InviteResponse = {
  invite: {
    token: string;
    status: string;
    walletAddress: string;
    email?: string | null;
    name?: string | null;
    designation?: string | null;
    permissionsMask: number;
    expiresAt?: string | null;
    workspace?: {
      name: string;
      type: string;
    } | null;
    settingsAccount?: {
      name: string;
      pda: string;
      threshold: number;
      timeLock: number;
    } | null;
  };
};

type ChallengeResponse = {
  walletAddress: string;
  message: string;
  nonceExpiresAt: string;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  return payload as T;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function shortAddress(address: string) {
  if (!address) return "-";
  return `${address.slice(0, 4)}····${address.slice(-4)}`;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { publicKey, connected, signMessage } = useWallet();
  const [invite, setInvite] = useState<InviteResponse["invite"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const token = params.token;
  const walletAddress = publicKey?.toBase58() ?? "";
  const walletMatches = useMemo(
    () => Boolean(invite && walletAddress && invite.walletAddress === walletAddress),
    [invite, walletAddress],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadInvite() {
      try {
        setLoading(true);
        setError("");
        const data = await apiRequest<InviteResponse>(`/invites/${encodeURIComponent(token)}`);
        if (!cancelled) setInvite(data.invite);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Invite could not be loaded");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function acceptInvite() {
    if (!invite || !walletAddress || !signMessage) return;
    try {
      setAccepting(true);
      setError("");
      const challenge = await apiRequest<ChallengeResponse>(
        `/invites/${encodeURIComponent(token)}/challenge`,
        {
          method: "POST",
          body: JSON.stringify({ walletAddress }),
        },
      );
      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      await apiRequest(`/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          message: challenge.message,
          signature: bytesToBase64(signature),
        }),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite acceptance failed");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#101010] px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white text-[18px] font-semibold text-black">
              H
            </div>
            <div>
              <p className="text-[13px] text-white/45">Hover treasury</p>
              <p className="text-[14px] font-medium">Signer invite</p>
            </div>
          </div>
          <CustomWalletButton />
        </header>

        <section className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/10 bg-[#151515] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center gap-2 text-[14px] text-white/55">
                <Loader2 className="animate-spin" size={17} />
                Loading invite
              </div>
            ) : (
              <>
                <div className="px-8 py-8">
                  <div className="mb-10 flex items-start justify-between gap-5">
                    <div>
                      <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-white/40">
                        {invite?.status ?? "Invite"}
                      </p>
                      <h1 className="mt-4 text-[42px] font-semibold tracking-[-0.05em]">
                        Join {invite?.workspace?.name ?? "workspace"}
                      </h1>
                      <p className="mt-3 max-w-lg text-[15px] leading-6 text-white/50">
                        Accept the signer invite with the wallet your team added to the Squads
                        settings account.
                      </p>
                    </div>
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-black">
                      <ShieldCheck size={23} />
                    </div>
                  </div>

                  {error && (
                    <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-[13px] leading-5 text-red-100">
                      {error}
                    </div>
                  )}

                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <ReviewRow label="Workspace" value={invite?.workspace?.name ?? "-"} />
                    <ReviewRow label="Name" value={invite?.name ?? "Invited signer"} />
                    <ReviewRow label="Role" value={invite?.designation ?? "Signer"} />
                    <ReviewRow label="Email" value={invite?.email ?? "-"} />
                    <ReviewRow
                      label="Invited wallet"
                      value={shortAddress(invite?.walletAddress ?? "")}
                      mono
                    />
                    <ReviewRow
                      label="Permissions"
                      value={`mask ${invite?.permissionsMask ?? 0}`}
                      mono
                    />
                    <ReviewRow
                      label="Settings"
                      value={shortAddress(invite?.settingsAccount?.pda ?? "")}
                      mono
                    />
                  </div>

                  {invite?.status === "ACCEPTED" ? (
                    <div className="mt-8 rounded-2xl bg-white px-5 py-4 text-[14px] font-semibold text-black">
                      This invite has already been accepted.
                    </div>
                  ) : (
                    <div className="mt-8 space-y-3">
                      {!connected || !walletAddress ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-[14px] text-white/55">
                          Connect the invited wallet to continue.
                        </div>
                      ) : !walletMatches ? (
                        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-4 text-[14px] leading-5 text-red-100">
                          Connected wallet {shortAddress(walletAddress)} does not match this invite.
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void acceptInvite()}
                        disabled={!walletMatches || accepting || !signMessage}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {accepting ? (
                          <Loader2 className="animate-spin" size={17} />
                        ) : (
                          <Wallet size={17} />
                        )}
                        {accepting ? "Verifying wallet" : "Accept invite"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 last:border-b-0">
      <span className="text-[13px] text-white/38">{label}</span>
      <span
        className={`min-w-0 truncate text-right text-[14px] text-white ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
