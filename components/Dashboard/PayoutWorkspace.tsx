"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  BuildSignedTransactionResponse,
  PayoutRecord,
  SendTransactionResponse,
  SettingsAccount,
  WalletSubmittedResponse,
} from "@/types";
import { apiRequest, base64ToBytes, bytesToBase64 } from "./helperfns";
import { formatDateTime, formatSol, humanStatus, shortAddress, statusTone } from "./helpers";

type Mode = "list" | "create" | "detail";
type DraftRecipient = {
  key: string;
  name: string;
  walletAddress: string;
  amountSol: string;
  memo: string;
};

const categories = [
  ["OTHER", "General"],
  ["PAYROLL", "Payroll"],
  ["GRANT", "Grant"],
  ["BOUNTY", "Bounty"],
  ["CONTRACTOR", "Contractor"],
  ["VENDOR", "Vendor"],
  ["REIMBURSEMENT", "Reimbursement"],
] as const;

const emptyRecipient = (): DraftRecipient => ({
  key: crypto.randomUUID(),
  name: "",
  walletAddress: "",
  amountSol: "",
  memo: "",
});

function lamportsFromSol(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * LAMPORTS_PER_SOL).toString() : "0";
}

function recipientStatus(status?: string | null) {
  if (!status) return "Draft";
  return humanStatus(status);
}

export function PayoutWorkspace({
  settingsAccount,
  walletAddress,
  onError,
}: {
  settingsAccount: SettingsAccount;
  walletAddress: string;
  onError: (message: string) => void;
}) {
  const { signTransaction } = useWallet();
  const [mode, setMode] = useState<Mode>("list");
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [selected, setSelected] = useState<PayoutRecord | null>(null);
  const [editing, setEditing] = useState<PayoutRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingRecipient, setSubmittingRecipient] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [smartAccountId, setSmartAccountId] = useState(settingsAccount.smartAccounts[0]?.id ?? "");
  const [recipients, setRecipients] = useState<DraftRecipient[]>([emptyRecipient()]);

  const query = useMemo(
    () =>
      `walletAddress=${encodeURIComponent(walletAddress)}&settingsPda=${encodeURIComponent(settingsAccount.pda)}`,
    [settingsAccount.pda, walletAddress],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiRequest<{ payouts: PayoutRecord[] }>(`/payouts?${query}`);
      setPayouts(response.payouts);
      setSelected((current) =>
        current
          ? (response.payouts.find((payout) => payout.id === current.id) ?? current)
          : current,
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not load payouts");
    } finally {
      setLoading(false);
    }
  }, [onError, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totalLamports = recipients.reduce(
    (total, recipient) => total + Number(lamportsFromSol(recipient.amountSol)),
    0,
  );
  const canSave = Boolean(
    title.trim() &&
    smartAccountId &&
    recipients.length &&
    recipients.every(
      (recipient) =>
        recipient.name.trim() && recipient.walletAddress.trim() && Number(recipient.amountSol) > 0,
    ),
  );

  function resetDraft() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setCategory("OTHER");
    setSmartAccountId(settingsAccount.smartAccounts[0]?.id ?? "");
    setRecipients([emptyRecipient()]);
  }

  function editDraft(payout: PayoutRecord) {
    setEditing(payout);
    setTitle(payout.title);
    setDescription(payout.description ?? "");
    setCategory(payout.category);
    setSmartAccountId(payout.smartAccountId);
    setRecipients(
      payout.recipients.map((recipient) => ({
        key: recipient.id,
        name: recipient.name,
        walletAddress: recipient.walletAddress,
        amountSol: String(Number(recipient.amountLamports) / LAMPORTS_PER_SOL),
        memo: recipient.memo ?? "",
      })),
    );
    setMode("create");
  }

  async function saveDraft() {
    if (!canSave) return;
    try {
      setSaving(true);
      const response = await apiRequest<{ payout: PayoutRecord }>(
        editing ? `/payouts/${editing.id}` : "/payouts",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            smartAccountId,
            title: title.trim(),
            description: description.trim() || null,
            category,
            recipients: recipients.map((recipient) => ({
              name: recipient.name.trim(),
              walletAddress: recipient.walletAddress.trim(),
              amountLamports: lamportsFromSol(recipient.amountSol),
              memo: recipient.memo.trim() || null,
            })),
          }),
        },
      );
      setPayouts((current) =>
        editing
          ? current.map((payout) => (payout.id === response.payout.id ? response.payout : payout))
          : [response.payout, ...current],
      );
      setSelected(response.payout);
      setMode("detail");
      resetDraft();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save payout");
    } finally {
      setSaving(false);
    }
  }

  async function submitRecipient(payout: PayoutRecord, recipientId: string) {
    if (!signTransaction) return;
    const recipient = payout.recipients.find((item) => item.id === recipientId);
    if (!recipient || recipient.transactionRecordId) return;
    try {
      setSubmittingRecipient(recipient.id);
      const createBuild = await apiRequest<BuildSignedTransactionResponse>(
        "/transactions/build-create",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            accountIndex: payout.accountIndex,
            recipient: recipient.walletAddress,
            amountLamports: recipient.amountLamports,
            memo: recipient.memo || `${payout.title}: ${recipient.name}`,
            smartAccountName: payout.smartAccountName,
          }),
        },
      );
      const createTransaction = Transaction.from(base64ToBytes(createBuild.transactionBase64));
      const signedCreate = await signTransaction(createTransaction);
      const createSent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedCreate.serialize()) }),
      });
      const proposalBuild = await apiRequest<BuildSignedTransactionResponse>(
        "/transactions/build-proposal",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            transactionIndex: createBuild.transactionIndex,
          }),
        },
      );
      const proposalTransaction = Transaction.from(base64ToBytes(proposalBuild.transactionBase64));
      const signedProposal = await signTransaction(proposalTransaction);
      const proposalSent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedProposal.serialize()) }),
      });
      const submitted = await apiRequest<WalletSubmittedResponse>(
        "/transactions/wallet-submitted",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            recipient: recipient.walletAddress,
            accountIndex: payout.accountIndex,
            transactionIndex: createBuild.transactionIndex,
            transactionPda: createBuild.transactionPda,
            proposalPda: proposalBuild.proposalPda,
            smartAccountPda: createBuild.smartAccountPda,
            amountLamports: recipient.amountLamports,
            memo: recipient.memo || `${payout.title}: ${recipient.name}`,
            smartAccountName: payout.smartAccountName,
            createTxSig: createSent.txSig,
            proposalTxSig: proposalSent.txSig,
          }),
        },
      );
      const linked = await apiRequest<{ payout: PayoutRecord }>(
        `/payouts/${payout.id}/recipients/${recipient.id}/transaction`,
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            transactionRecordId: submitted.transaction.id,
          }),
        },
      );
      setSelected(linked.payout);
      setPayouts((current) =>
        current.map((item) => (item.id === linked.payout.id ? linked.payout : item)),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not submit payout recipient");
    } finally {
      setSubmittingRecipient("");
    }
  }

  async function submitRemaining(payout: PayoutRecord) {
    for (const recipient of payout.recipients) {
      if (!recipient.transactionRecordId) {
        await submitRecipient(payout, recipient.id);
        break;
      }
    }
  }

  async function refreshPayout(payout: PayoutRecord) {
    try {
      setLoading(true);
      for (const recipient of payout.recipients) {
        if (recipient.transactionRecordId) {
          await apiRequest(`/transactions/${recipient.transactionRecordId}/refresh`, {
            method: "POST",
          });
        }
      }
      const response = await apiRequest<{ payout: PayoutRecord }>(`/payouts/${payout.id}?${query}`);
      setSelected(response.payout);
      setPayouts((current) =>
        current.map((item) => (item.id === response.payout.id ? response.payout : item)),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not refresh payout");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDraft(payout: PayoutRecord) {
    try {
      setSaving(true);
      await apiRequest(`/payouts/${payout.id}`, {
        method: "DELETE",
        body: JSON.stringify({ walletAddress, settingsPda: settingsAccount.pda }),
      });
      setPayouts((current) => current.filter((item) => item.id !== payout.id));
      setSelected(null);
      setMode("list");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete payout");
    } finally {
      setSaving(false);
    }
  }

  if (mode === "create") {
    return (
      <section className="mt-10 grid gap-0 overflow-hidden rounded-2xl border border-neutral-200 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="bg-white p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase text-neutral-400">Payout draft</p>
              <h2 className="mt-1 text-[24px] font-semibold">Recipients and context</h2>
            </div>
            <button
              type="button"
              onClick={() => setMode("list")}
              className="text-[13px] text-neutral-500 hover:text-neutral-950"
            >
              Close
            </button>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="text-[12.5px] font-medium text-neutral-600 sm:col-span-2">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="September contributor payouts"
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 px-3 text-[14px] outline-none focus:border-neutral-950"
              />
            </label>
            <label className="text-[12.5px] font-medium text-neutral-600">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-950"
              >
                {categories.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12.5px] font-medium text-neutral-600">
              Funding account
              <select
                value={smartAccountId}
                onChange={(event) => setSmartAccountId(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-950"
              >
                {settingsAccount.smartAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12.5px] font-medium text-neutral-600 sm:col-span-2">
              Description <span className="font-normal text-neutral-400">Optional</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-lg border border-neutral-200 p-3 text-[14px] outline-none focus:border-neutral-950"
              />
            </label>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h3 className="text-[16px] font-semibold">Recipients</h3>
            <button
              type="button"
              onClick={() => setRecipients((current) => [...current, emptyRecipient()])}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-3 text-[13px] font-semibold hover:bg-neutral-50"
            >
              <Plus size={14} /> Add recipient
            </button>
          </div>
          <div className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {recipients.map((recipient, index) => (
              <div
                key={recipient.key}
                className="grid gap-3 p-4 lg:grid-cols-[1fr_1.45fr_0.55fr_1fr_auto] lg:items-end"
              >
                <label className="text-[11.5px] font-medium text-neutral-500">
                  Name
                  <input
                    value={recipient.name}
                    onChange={(event) =>
                      setRecipients((current) =>
                        current.map((item) =>
                          item.key === recipient.key ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] text-neutral-950 outline-none focus:border-neutral-950"
                  />
                </label>
                <label className="text-[11.5px] font-medium text-neutral-500">
                  Wallet
                  <input
                    value={recipient.walletAddress}
                    onChange={(event) =>
                      setRecipients((current) =>
                        current.map((item) =>
                          item.key === recipient.key
                            ? { ...item, walletAddress: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 font-mono text-[12px] text-neutral-950 outline-none focus:border-neutral-950"
                  />
                </label>
                <label className="text-[11.5px] font-medium text-neutral-500">
                  SOL
                  <input
                    type="number"
                    min="0"
                    step="0.000000001"
                    value={recipient.amountSol}
                    onChange={(event) =>
                      setRecipients((current) =>
                        current.map((item) =>
                          item.key === recipient.key
                            ? { ...item, amountSol: event.target.value }
                            : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] text-neutral-950 outline-none focus:border-neutral-950"
                  />
                </label>
                <label className="text-[11.5px] font-medium text-neutral-500">
                  Memo
                  <input
                    value={recipient.memo}
                    onChange={(event) =>
                      setRecipients((current) =>
                        current.map((item) =>
                          item.key === recipient.key ? { ...item, memo: event.target.value } : item,
                        ),
                      )
                    }
                    className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[13px] text-neutral-950 outline-none focus:border-neutral-950"
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Remove recipient ${index + 1}`}
                  disabled={recipients.length === 1}
                  onClick={() =>
                    setRecipients((current) => current.filter((item) => item.key !== recipient.key))
                  }
                  className="flex size-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-25"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-neutral-200 bg-neutral-950 p-6 text-white xl:border-l xl:border-t-0 lg:p-8">
          <p className="text-[12px] font-semibold uppercase text-white/40">Review</p>
          <h3 className="mt-5 text-[26px] font-semibold">{title || "Untitled payout"}</h3>
          <p className="mt-2 text-[13px] text-white/50">
            {recipients.length} recipients from{" "}
            {settingsAccount.smartAccounts.find((account) => account.id === smartAccountId)?.name ??
              "a smart account"}
          </p>
          <div className="mt-8 border-y border-white/10 py-5">
            <p className="text-[12px] text-white/40">Total</p>
            <p className="mt-2 text-[32px] font-semibold">{formatSol(totalLamports)}</p>
          </div>
          <p className="mt-5 text-[12.5px] leading-5 text-white/45">
            Each recipient becomes an independent proposal. You can stop and resume submission
            without duplicating completed recipients.
          </p>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={!canSave || saving}
            className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white text-[13px] font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : null}
            {editing ? "Save changes" : "Save draft"}
          </button>
        </aside>
      </section>
    );
  }

  if (mode === "detail" && selected) {
    const submitted = selected.recipients.filter(
      (recipient) => recipient.transactionRecordId,
    ).length;
    const settled = selected.recipients.filter(
      (recipient) => recipient.transactionStatus === "EXECUTED",
    ).length;
    const nextRecipient = selected.recipients.find((recipient) => !recipient.transactionRecordId);
    return (
      <section className="mt-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="flex size-10 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[24px] font-semibold">{selected.title}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(selected.status)}`}
                >
                  {humanStatus(selected.status)}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-neutral-500">
                {selected.smartAccountName} · {selected.category.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshPayout(selected)}
              disabled={loading}
              className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-4 text-[13px] font-semibold hover:bg-neutral-50"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={14} /> Refresh
            </button>
            {selected.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => editDraft(selected)}
                className="h-9 rounded-full border border-neutral-200 px-4 text-[13px] font-semibold hover:bg-neutral-50"
              >
                Edit
              </button>
            )}
            {nextRecipient && (
              <button
                type="button"
                onClick={() => void submitRemaining(selected)}
                disabled={Boolean(submittingRecipient)}
                className="flex h-9 items-center gap-2 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                {submittingRecipient ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Send size={14} />
                )}{" "}
                Submit next
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
          {[
            ["Total", formatSol(selected.totalLamports)],
            ["Recipients", String(selected.recipients.length)],
            ["Submitted", `${submitted}/${selected.recipients.length}`],
            ["Settled", `${settled}/${selected.recipients.length}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-5">
              <p className="text-[12px] text-neutral-400">{label}</p>
              <p className="mt-2 text-[20px] font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <div className="hidden grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_1fr] gap-4 border-b border-neutral-100 px-5 py-3 text-[11px] font-semibold uppercase text-neutral-400 md:grid">
            <span>Recipient</span>
            <span>Wallet</span>
            <span>Amount</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {selected.recipients.map((recipient) => {
              const rejected = ["REJECTED", "CANCELLED"].includes(
                recipient.transactionStatus ?? "",
              );
              const executed = recipient.transactionStatus === "EXECUTED";
              return (
                <div
                  key={recipient.id}
                  className="grid gap-3 px-5 py-4 text-[13px] md:grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_1fr] md:items-center"
                >
                  <div>
                    <p className="font-semibold">{recipient.name}</p>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                      {recipient.memo || "No memo"}
                    </p>
                  </div>
                  <p className="truncate font-mono text-[12px] text-neutral-500">
                    {shortAddress(recipient.walletAddress)}
                  </p>
                  <p className="font-semibold">{formatSol(recipient.amountLamports)}</p>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${recipient.transactionStatus ? statusTone(recipient.transactionStatus) : "bg-neutral-100 text-neutral-600"}`}
                  >
                    {recipientStatus(recipient.transactionStatus)}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    {executed ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
                        <CheckCircle2 size={14} /> Settled
                      </span>
                    ) : rejected ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-600">
                        <XCircle size={14} /> Rejected
                      </span>
                    ) : recipient.transactionRecordId ? (
                      <span className="text-[12px] font-medium text-neutral-500">
                        Transaction #{recipient.transactionIndex}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void submitRecipient(selected, recipient.id)}
                        disabled={Boolean(submittingRecipient)}
                        className="h-8 rounded-full border border-neutral-200 px-3 text-[12px] font-semibold hover:bg-neutral-950 hover:text-white disabled:opacity-35"
                      >
                        {submittingRecipient === recipient.id ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : (
                          "Submit"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {selected.status === "DRAFT" && (
          <button
            type="button"
            onClick={() => void deleteDraft(selected)}
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 text-[12px] font-semibold text-red-600 hover:text-red-700"
          >
            <Trash2 size={14} /> Delete draft
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-5">
        <div>
          <h2 className="text-[22px] font-semibold">Payouts</h2>
          <p className="mt-1 text-[13px] text-neutral-500">
            Prepare and track controlled distributions from your smart accounts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetDraft();
            setMode("create");
          }}
          className="flex h-10 items-center gap-2 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white"
        >
          <Plus size={14} /> New payout
        </button>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {loading && !payouts.length ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-[13px] text-neutral-400">
            <Loader2 className="animate-spin" size={15} /> Loading payouts
          </div>
        ) : payouts.length ? (
          <div className="divide-y divide-neutral-100">
            {payouts.map((payout) => (
              <button
                key={payout.id}
                type="button"
                onClick={() => {
                  setSelected(payout);
                  setMode("detail");
                }}
                className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-neutral-50 md:grid-cols-[1.5fr_0.85fr_0.8fr_0.8fr_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white">
                    <CircleDollarSign size={16} />
                  </span>
                  <div>
                    <p className="font-semibold">{payout.title}</p>
                    <p className="mt-0.5 text-[12px] text-neutral-400">
                      {payout.smartAccountName} · {formatDateTime(payout.createdAt)}
                    </p>
                  </div>
                </div>
                <p className="text-[13px] text-neutral-600">
                  {payout.recipients.length} recipients
                </p>
                <p className="text-[13px] font-semibold">{formatSol(payout.totalLamports)}</p>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(payout.status)}`}
                >
                  {humanStatus(payout.status)}
                </span>
                <ChevronRight size={15} className="text-neutral-400" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <CircleDollarSign size={22} className="text-neutral-300" />
            <p className="mt-3 text-[14px] font-semibold">No payouts yet</p>
            <p className="mt-1 text-[12.5px] text-neutral-400">
              Create a controlled distribution for any business use case.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
