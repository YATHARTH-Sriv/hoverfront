import { LAMPORTS_PER_SOL } from "@solana/web3.js";

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-white">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl text-black border border-neutral-200 bg-white px-3 text-[13px] outline-none transition-colors placeholder:text-black focus:border-neutral-400"
      />
    </label>
  );
}

function formatSol(value: string | number | undefined) {
  const lamports = Number(value ?? 0);
  return `${(lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SOL`;
}

function formatReceiptAmount(value: string | number | null | undefined, currency?: string | null) {
  if (value === null || value === undefined || value === "") return "Amount not found";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Amount not found";
  const normalizedAmount = Object.is(amount, -0) ? 0 : amount;
  const formatted = normalizedAmount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 9,
  });
  return `${formatted}${currency?.trim() ? ` ${currency.trim()}` : ""}`;
}

function hasPermission(mask: number | undefined, permission: "initiate" | "approve" | "execute") {
  const value = mask ?? 0;
  if (permission === "initiate") return (value & 1) !== 0;
  if (permission === "approve") return (value & 2) !== 0;
  return (value & 4) !== 0;
}

// Deterministic accent per signer/activity so avatars stay visually distinct but stable across renders.
const AVATAR_COLORS = [
  { bg: "#DCEFE3", fg: "#1F7A4D" },
  { bg: "#E4E9FB", fg: "#3D4FBF" },
  { bg: "#FBE6D9", fg: "#B4581C" },
  { bg: "#F3E1F5", fg: "#8E3A9E" },
  { bg: "#DEF0F3", fg: "#1B7C8C" },
];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1)
    hash = (hash * 31 + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function initials(value?: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return (parts[0] ?? "WA").slice(0, 2).toUpperCase();
}

function permissionActions(mask?: number) {
  const value = mask ?? 0;
  const actions: string[] = [];
  if ((value & 1) !== 0) actions.push("Initiate");
  if ((value & 2) !== 0) actions.push("Approve");
  if ((value & 4) !== 0) actions.push("Execute");
  return actions.length ? actions : ["No actions"];
}

function PermissionChips({ mask, align = "end" }: { mask?: number; align?: "start" | "end" }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {permissionActions(mask).map((action) => (
        <span
          key={action}
          className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-700"
        >
          {action}
        </span>
      ))}
    </div>
  );
}

function shortAddress(address: string) {
  if (!address) return "-";
  return `${address.slice(0, 6)}···${address.slice(-6)}`;
}

function humanStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (
    normalized.includes("EXECUTED") ||
    normalized.includes("APPROVED") ||
    normalized.includes("COMPLETED")
  ) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (
    normalized.includes("REJECTED") ||
    normalized.includes("CANCELLED") ||
    normalized.includes("FAILED")
  ) {
    return "bg-red-50 text-red-700";
  }
  if (
    normalized.includes("PROPOSAL") ||
    normalized.includes("PENDING") ||
    normalized.includes("IN_PROGRESS")
  ) {
    return "bg-orange-50 text-orange-700";
  }
  return "bg-neutral-100 text-neutral-600";
}

export {
  TextField,
  formatSol,
  formatReceiptAmount,
  hasPermission,
  avatarColor,
  initials,
  PermissionChips,
  shortAddress,
  statusTone,
  humanStatus,
  formatDateTime,
};
