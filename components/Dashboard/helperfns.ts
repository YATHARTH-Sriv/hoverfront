import { API_BASE } from "@/constant";
import { SettingsAccount } from "@/types";

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

function totalBalance(settings?: SettingsAccount) {
  return (
    settings?.smartAccounts.reduce(
      (sum, account) => sum + Number(account.balanceLamports ?? 0),
      0,
    ) ?? 0
  );
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export { base64ToBytes, bytesToBase64, totalBalance, apiRequest };
