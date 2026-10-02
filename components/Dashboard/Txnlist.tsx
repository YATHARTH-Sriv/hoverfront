import { useState } from "react";
import { SettingsSigner, TransactionRecord } from "@/types";
import { Eye, Loader2, X } from "lucide-react";
import {
  avatarColor,
  formatDateTime,
  formatSol,
  hasPermission,
  humanStatus,
  initials,
  shortAddress,
  statusTone,
} from "./helpers";

export function TransactionList({
  transactions,
  threshold,
  walletAddress,
  currentSigner,
  acting,
  onApprove,
  onReject,
  onExecute,
  variant = "manage",
}: {
  transactions: TransactionRecord[];
  threshold: number;
  walletAddress: string;
  currentSigner?: SettingsSigner;
  acting: string;
  onApprove: (transaction: TransactionRecord) => Promise<void>;
  onReject: (transaction: TransactionRecord) => Promise<void>;
  onExecute: (transaction: TransactionRecord) => Promise<void>;
  variant?: "manage" | "summary";
}) {
  const [detailsTransaction, setDetailsTransaction] = useState<TransactionRecord | null>(null);
  const canApprovePermission = hasPermission(currentSigner?.permissionsMask, "approve");
  const canExecutePermission = hasPermission(currentSigner?.permissionsMask, "execute");

  if (variant === "summary") {
    return (
      <div className="mt-5 overflow-hidden rounded-2xl bg-white text-neutral-950">
        {transactions.length ? (
          <div className="divide-y divide-neutral-100">
            {transactions.map((transaction) => {
              const label =
                transaction.payout?.recipientName || transaction.memo?.trim() || "Treasury payment";
              const color = avatarColor(`${transaction.id}${transaction.recipient ?? ""}`);
              const isStale = transaction.isStale === true;

              return (
                <div
                  key={transaction.id}
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      {initials(label)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[13px] font-semibold">{label}</p>
                        {transaction.payout && (
                          <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-semibold uppercase text-neutral-500">
                            {humanStatus(transaction.payout.category)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-[11.5px] text-neutral-400">
                        {formatSol(transaction.amountLamports)} · {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-[11.5px] font-medium ${
                      isStale ? "bg-amber-50 text-amber-700" : statusTone(transaction.status)
                    }`}
                  >
                    {isStale ? "Stale" : humanStatus(transaction.status)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-28 items-center justify-center text-[13px] text-neutral-400">
            No transactions yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 overflow-hidden rounded-2xl bg-white text-neutral-950">
      {transactions.length ? (
        <>
          <div className="hidden grid-cols-[1.75fr_1fr_0.85fr_0.75fr_0.85fr_1fr_1.55fr] gap-4 border-b border-neutral-100 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400 md:grid">
            <span>Name</span>
            <span>Status</span>
            <span>Account</span>
            <span>Created</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Votes</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {transactions.map((transaction) => {
              const label =
                transaction.payout?.recipientName || transaction.memo?.trim() || "Treasury payment";
              const approvalCount =
                transaction.approvals?.filter((approval) => approval.status === "APPROVED")
                  .length ?? 0;
              const rejectionCount =
                transaction.approvals?.filter((approval) => approval.status === "REJECTED")
                  .length ?? 0;
              const color = avatarColor(`${transaction.id}${transaction.recipient ?? ""}`);
              const normalizedStatus = transaction.status.toUpperCase();
              const isExecuted = normalizedStatus.includes("EXECUTED");
              const isApproved = normalizedStatus.includes("APPROVED");
              const isStale = transaction.isStale === true;
              const isRejected =
                normalizedStatus.includes("REJECTED") || normalizedStatus.includes("CANCELLED");
              const voteSlots = Math.max(threshold, approvalCount + rejectionCount, 1);
              const approvedByWallet = transaction.approvals?.some(
                (approval) =>
                  approval.walletAddress === walletAddress && approval.status === "APPROVED",
              );
              const rejectedByWallet = transaction.approvals?.some(
                (approval) =>
                  approval.walletAddress === walletAddress && approval.status === "REJECTED",
              );
              const approveDisabled =
                !canApprovePermission ||
                isStale ||
                isExecuted ||
                isRejected ||
                approvedByWallet ||
                acting === `approve-${transaction.id}`;
              const rejectDisabled =
                !canApprovePermission ||
                isStale ||
                isApproved ||
                isExecuted ||
                isRejected ||
                rejectedByWallet ||
                acting === `reject-${transaction.id}`;
              const executeDisabled =
                !canExecutePermission ||
                isStale ||
                !isApproved ||
                isExecuted ||
                isRejected ||
                acting === `execute-${transaction.id}`;
              return (
                <div
                  key={transaction.id}
                  className={`relative grid gap-4 px-5 py-4 text-[13px] transition-colors md:grid-cols-[1.75fr_1fr_0.85fr_0.75fr_0.85fr_1fr_1.55fr] md:items-center ${isStale ? "bg-neutral-50 text-neutral-400" : "hover:bg-neutral-50"}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      {initials(label)}
                    </div>
                    <div className="min-w-0">
                      {transaction.payout && (
                        <span className="mb-1 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase text-neutral-500">
                          {humanStatus(transaction.payout.category)}
                        </span>
                      )}
                      <p
                        className={`truncate font-semibold ${isStale ? "text-neutral-400 line-through decoration-neutral-400" : "text-neutral-950"}`}
                      >
                        {label}
                      </p>
                      {transaction.payout && (
                        <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-600">
                          {transaction.payout.title}
                        </p>
                      )}
                      {transaction.payout && (
                        <button
                          type="button"
                          onClick={() => setDetailsTransaction(transaction)}
                          className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-500 transition-colors hover:text-neutral-950"
                        >
                          <Eye size={12} />
                          Open details
                        </button>
                      )}
                      <p className="mt-0.5 truncate font-mono text-[12px] text-neutral-400">
                        #{String(transaction.transactionIndex)} ·{" "}
                        {shortAddress(transaction.recipient ?? "")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${isStale ? "bg-amber-50 text-amber-700" : statusTone(transaction.status)}`}
                      title={transaction.staleReason ?? undefined}
                    >
                      {isStale ? "Stale" : humanStatus(transaction.status)}
                    </span>
                  </div>

                  <p
                    className={`truncate font-medium ${isStale ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-700"}`}
                  >
                    {transaction.accountIndex == null
                      ? shortAddress(transaction.smartAccountPda ?? "")
                      : `index ${transaction.accountIndex}`}
                  </p>

                  <p className="text-neutral-500">{formatDateTime(transaction.createdAt)}</p>

                  <p
                    className={`font-semibold md:text-right ${isStale ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-950"}`}
                  >
                    {formatSol(transaction.amountLamports)}
                  </p>

                  <div
                    className="flex items-center gap-1.5 md:justify-end"
                    aria-label={
                      isStale
                        ? "Proposal is stale and must be recreated"
                        : `${approvalCount} approvals and ${rejectionCount} rejections`
                    }
                  >
                    {isStale ? (
                      <span className="text-[12px] font-medium text-amber-700">Recreate</span>
                    ) : (
                      Array.from({ length: voteSlots }).map((_, index) => (
                        <span
                          key={`${transaction.id}-vote-${index}`}
                          className={`h-5 w-1.5 rounded-full ${
                            index < approvalCount
                              ? "bg-emerald-500"
                              : index < approvalCount + rejectionCount
                                ? "bg-red-500"
                                : "bg-neutral-200"
                          }`}
                        />
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2 md:justify-end">
                    {!isApproved &&
                      !isExecuted &&
                      !isRejected &&
                      !isStale &&
                      canApprovePermission && (
                        <>
                          <button
                            type="button"
                            onClick={() => void onApprove(transaction)}
                            disabled={approveDisabled}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-neutral-200 px-3 text-[12px] font-semibold text-neutral-700 transition-colors hover:bg-neutral-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {acting === `approve-${transaction.id}` ? (
                              <Loader2 className="animate-spin" size={13} />
                            ) : approvedByWallet ? (
                              "Approved"
                            ) : (
                              "Approve"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onReject(transaction)}
                            disabled={rejectDisabled}
                            className="inline-flex h-8 items-center justify-center rounded-full border border-red-200 px-3 text-[12px] font-semibold text-red-600 transition-colors hover:border-red-600 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {acting === `reject-${transaction.id}` ? (
                              <Loader2 className="animate-spin" size={13} />
                            ) : rejectedByWallet ? (
                              "Rejected"
                            ) : (
                              "Reject"
                            )}
                          </button>
                        </>
                      )}
                    {!isStale && canExecutePermission && (
                      <button
                        type="button"
                        onClick={() => void onExecute(transaction)}
                        disabled={executeDisabled}
                        className="inline-flex h-8 items-center justify-center rounded-full bg-neutral-950 px-3 text-[12px] font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-25"
                      >
                        {acting === `execute-${transaction.id}` ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : isExecuted ? (
                          "Done"
                        ) : (
                          "Execute"
                        )}
                      </button>
                    )}
                    {!canApprovePermission && !canExecutePermission && (
                      <span className="text-[12px] font-medium text-neutral-400">View only</span>
                    )}
                    {isStale && (
                      <span
                        className="text-right text-[12px] font-medium leading-4 text-neutral-500"
                        title={transaction.staleReason ?? undefined}
                      >
                        No longer valid
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex min-h-28 items-center justify-center text-[13px] text-neutral-400">
          No transactions yet.
        </div>
      )}
      </div>

      {detailsTransaction?.payout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payout-transaction-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailsTransaction(null);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[#F7F7F5] shadow-[0_30px_100px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-5 border-b border-neutral-200 px-6 py-5">
              <div>
                <span className="inline-flex rounded-full bg-neutral-200 px-2.5 py-1 text-[10px] font-semibold uppercase text-neutral-600">
                  {humanStatus(detailsTransaction.payout.category)}
                </span>
                <h2
                  id="payout-transaction-title"
                  className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-neutral-950"
                >
                  {detailsTransaction.payout.recipientName}
                </h2>
                <p className="mt-1 text-[13px] text-neutral-500">
                  {detailsTransaction.payout.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsTransaction(null)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-950"
                aria-label="Close payout details"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              {(detailsTransaction.payout.description ||
                detailsTransaction.payout.recipientMemo) && (
                <div className="space-y-4">
                  {detailsTransaction.payout.description && (
                    <DetailField
                      label="Payout context"
                      value={detailsTransaction.payout.description}
                    />
                  )}
                  {detailsTransaction.payout.recipientMemo && (
                    <DetailField
                      label="Recipient memo"
                      value={detailsTransaction.payout.recipientMemo}
                    />
                  )}
                </div>
              )}

              <div className="grid overflow-hidden rounded-xl border border-neutral-200 bg-white sm:grid-cols-2">
                <DetailCell label="Amount" value={formatSol(detailsTransaction.amountLamports)} />
                <DetailCell
                  label="Status"
                  value={detailsTransaction.isStale ? "Stale" : humanStatus(detailsTransaction.status)}
                />
                <DetailCell
                  label="Recipient wallet"
                  value={detailsTransaction.recipient ?? "Not available"}
                  mono
                />
                <DetailCell
                  label="Transaction index"
                  value={`#${String(detailsTransaction.transactionIndex)}`}
                  mono
                />
                <DetailCell
                  label="Approvals"
                  value={String(
                    detailsTransaction.approvals?.filter(
                      (approval) => approval.status === "APPROVED",
                    ).length ?? 0,
                  )}
                />
                <DetailCell
                  label="Rejections"
                  value={String(
                    detailsTransaction.approvals?.filter(
                      (approval) => approval.status === "REJECTED",
                    ).length ?? 0,
                  )}
                />
                <DetailCell
                  label="Created"
                  value={formatDateTime(detailsTransaction.createdAt)}
                />
                <DetailCell
                  label="Smart account"
                  value={
                    detailsTransaction.accountIndex == null
                      ? shortAddress(detailsTransaction.smartAccountPda ?? "")
                      : `index ${detailsTransaction.accountIndex}`
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-neutral-400">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-neutral-700">{value}</p>
    </div>
  );
}

function DetailCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-neutral-100 px-4 py-3.5 odd:sm:border-r">
      <p className="text-[10.5px] font-semibold uppercase text-neutral-400">{label}</p>
      <p className={`mt-1 truncate text-[13px] text-neutral-800 ${mono ? "font-mono" : "font-medium"}`} title={value}>
        {value}
      </p>
    </div>
  );
}
