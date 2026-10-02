"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import CustomWalletButton from "@/components/customwalletbutton";
import { API_BASE } from "@/constant";

type SettingsAccount = {
  id: string;
  name: string;
  pda: string;
  signers: Array<{ walletAddress: string; name?: string | null; label?: string | null }>;
};

type DashboardResponse = {
  settings: SettingsAccount[];
};

type ChallengeResponse = {
  message: string;
};

type ExtensionSessionResponse = {
  code: string;
  expiresAt: string;
  settings: { name: string; pda: string };
};

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (
          extensionId: string,
          message: Record<string, unknown>,
          callback?: (response?: { ok?: boolean; error?: string }) => void,
        ) => void;
        lastError?: { message?: string };
      };
    };
  }
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
  if (!response.ok)
    throw new Error(typeof payload.error === "string" ? payload.error : "Request failed");
  return payload as T;
}

function shortAddress(address?: string | null) {
  if (!address) return "";
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function ExtensionConnectContent() {
  const { publicKey, connected, signMessage } = useWallet();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<SettingsAccount[]>([]);
  const [selectedPda, setSelectedPda] = useState("");
  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<ExtensionSessionResponse | null>(null);
  const extensionId = searchParams.get("extensionId") ?? "";
  const codeChallenge = searchParams.get("codeChallenge") ?? "";
  const authorizationState = searchParams.get("state") ?? "";

  const walletAddress = publicKey?.toBase58() ?? "";
  const selectedSettings = useMemo(
    () => settings.find((item) => item.pda === selectedPda) ?? settings[0],
    [settings, selectedPda],
  );

  const loadSettings = useCallback(async () => {
    if (!walletAddress) return;
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest<DashboardResponse>(
        `/dashboard?walletAddress=${encodeURIComponent(walletAddress)}&refresh=false`,
      );
      setSettings(data.settings ?? []);
      setSelectedPda((current) => current || data.settings?.[0]?.pda || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Hover workspaces.");
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function authorize() {
    if (!walletAddress || !signMessage || !selectedSettings) {
      setError("Connect a wallet that can sign messages.");
      return;
    }
    if (!extensionId || !codeChallenge || !authorizationState) {
      setError("Open this page from Hover Capture to authorize the extension.");
      return;
    }
    try {
      setAuthorizing(true);
      setError("");
      const challenge = await apiRequest<ChallengeResponse>("/auth/challenge", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          purpose: "extension-session",
          settingsPda: selectedSettings.pda,
          codeChallenge,
          extensionId,
        }),
      });
      const signature = await signMessage(new TextEncoder().encode(challenge.message));
      const created = await apiRequest<ExtensionSessionResponse>("/auth/extension-session", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          settingsPda: selectedSettings.pda,
          message: challenge.message,
          signature: bytesToBase64(signature),
          name: "Hover Capture extension",
          codeChallenge,
          extensionId,
        }),
      });
      setSession(created);
      if (extensionId && window.chrome?.runtime?.sendMessage) {
        const response = await new Promise<{ ok?: boolean; error?: string }>((resolve, reject) => {
          window.chrome?.runtime?.sendMessage?.(
            extensionId,
            {
              type: "HOVER_EXTENSION_AUTH_CODE",
              code: created.code,
              state: authorizationState,
            },
            (reply) => {
              const lastError = window.chrome?.runtime?.lastError;
              if (lastError?.message) {
                reject(new Error(lastError.message));
                return;
              }
              resolve(reply ?? {});
            },
          );
        });
        if (!response.ok)
          throw new Error(response.error || "Could not finish extension connection.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the extension.");
    } finally {
      setAuthorizing(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#f7f6f3] px-5 py-8 text-neutral-950 sm:px-8">
      <section className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-neutral-950 text-[15px] font-semibold text-white">
              H
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Hover Capture
              </p>
              <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">
                Connect extension
              </h1>
            </div>
          </div>
          <CustomWalletButton />
        </header>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
          <div className="border-b border-neutral-100 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-[22px] font-semibold tracking-[-0.03em]">
                  Authorize bill capture
                </h2>
                <p className="mt-2 max-w-xl text-[14px] leading-6 text-neutral-500">
                  Hover only receives the bill, PDF, image, or selected email text you choose. It
                  never asks for Gmail access.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 sm:p-8">
            {!connected ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-5 text-[14px] text-neutral-500">
                Connect your signer wallet to choose a Hover workspace.
              </div>
            ) : loading ? (
              <div className="flex min-h-28 items-center gap-2 rounded-2xl border border-neutral-200 p-5 text-[14px] text-neutral-500">
                <Loader2 className="animate-spin" size={16} />
                Loading workspaces
              </div>
            ) : settings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 p-5 text-[14px] text-neutral-500">
                This wallet is not a signer on an indexed Hover settings account yet.
              </div>
            ) : (
              <label
                className="grid gap-2 text-[13px] font-semibold text-neutral-700"
                htmlFor="settings-pda"
              >
                Hover workspace
                <select
                  id="settings-pda"
                  value={selectedSettings?.pda ?? ""}
                  onChange={(event) => setSelectedPda(event.target.value)}
                  className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-[14px] text-neutral-950 outline-none transition focus-visible:ring-2 focus-visible:ring-neutral-950/20"
                >
                  {settings.map((item) => (
                    <option key={item.id} value={item.pda}>
                      {item.name} - {shortAddress(item.pda)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] leading-5 text-red-700">
                {error}
              </div>
            )}

            {session ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[13px] font-semibold text-emerald-800">Extension connected</p>
                <p className="mt-1 text-[13px] leading-5 text-emerald-700">
                  Hover Capture is now linked to {session.settings.name}. You can close this tab and
                  capture bills from the extension.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={authorize}
                disabled={!connected || !selectedSettings || authorizing}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 text-[14px] font-semibold text-white transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-950/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {authorizing ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Wallet size={16} />
                )}
                {authorizing ? "Waiting for wallet" : "Authorize extension"}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ExtensionConnectPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[#f7f6f3] px-5 py-8 text-neutral-950 sm:px-8">
          <section className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-neutral-950 text-[15px] font-semibold text-white">
                H
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                  Hover Capture
                </p>
                <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em]">
                  Connect extension
                </h1>
              </div>
            </div>
          </section>
        </main>
      }
    >
      <ExtensionConnectContent />
    </Suspense>
  );
}
