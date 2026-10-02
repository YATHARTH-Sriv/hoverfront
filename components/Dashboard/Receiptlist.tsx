import { ReceiptRecord } from "@/types";
import { CheckCircle2, Eye, FileText, Send, Trash2 } from "lucide-react";
import { formatDateTime, formatReceiptAmount, humanStatus, statusTone } from "./helpers";

export function ReceiptList({
  receipts,
  onOpenReceipt,
  onDeleteReceipt,
  onPreparePayment,
}: {
  receipts: ReceiptRecord[];
  onOpenReceipt: (receipt: ReceiptRecord) => void;
  onDeleteReceipt?: (receipt: ReceiptRecord) => void;
  onPreparePayment?: (receipt: ReceiptRecord) => void;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl bg-white text-neutral-950">
      {receipts.length ? (
        <div className="divide-y divide-neutral-100">
          {receipts.map((receipt) => {
            const label = receipt.vendor?.trim() || receipt.fileName || "Receipt";
            const amount = formatReceiptAmount(receipt.amount, receipt.currency);
            const canPreparePayment =
              !receipt.transactionRecordId &&
              !["PAYMENT_PREPARED", "PAID", "ARCHIVED"].includes(receipt.status);
            const preparedLabel = receipt.status === "PAID" ? "Paid" : "Prepared";
            const showPreparedState =
              Boolean(receipt.transactionRecordId) ||
              ["PAYMENT_PREPARED", "PAID"].includes(receipt.status);
            const canDeleteReceipt =
              onDeleteReceipt &&
              !receipt.transactionRecordId &&
              !["PAYMENT_PREPARED", "PAID", "ARCHIVED"].includes(receipt.status);
            return (
              <div
                key={receipt.id}
                className="grid gap-4 px-5 py-4 text-[13px] transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(220px,1.5fr)_140px_150px_96px_220px] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-950">{label}</p>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                      {receipt.invoiceNumber
                        ? `invoice ${receipt.invoiceNumber}`
                        : (receipt.fileName ?? "Uploaded bill")}
                    </p>
                  </div>
                </div>
                <p className="font-mono font-semibold tabular-nums text-neutral-950">{amount}</p>
                <span
                  className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[12px] font-medium ${statusTone(receipt.status)}`}
                >
                  {humanStatus(receipt.status)}
                </span>
                <p className="text-neutral-500">{formatDateTime(receipt.createdAt)}</p>
                <div className="flex min-w-0 flex-wrap items-center gap-2 md:w-[220px] md:flex-nowrap md:justify-end">
                  {onPreparePayment && canPreparePayment && (
                    <button
                      type="button"
                      onClick={() => onPreparePayment(receipt)}
                      className="inline-flex h-9 w-[112px] items-center justify-center gap-2 rounded-full bg-neutral-950 px-3 text-[12px] font-semibold text-white transition hover:opacity-90"
                    >
                      <Send size={13} />
                      Prepare
                    </button>
                  )}
                  {onPreparePayment && !canPreparePayment && showPreparedState && (
                    <span className="inline-flex h-9 w-[112px] items-center justify-center gap-2 rounded-full bg-neutral-100 px-3 text-[12px] font-semibold text-neutral-500">
                      <CheckCircle2 size={13} />
                      {preparedLabel}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenReceipt(receipt)}
                    className="inline-flex h-9 w-[92px] items-center justify-center gap-2 rounded-full border border-neutral-200 px-3 text-[12px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  >
                    <Eye size={14} />
                    Open
                  </button>
                  {canDeleteReceipt && (
                    <button
                      type="button"
                      onClick={() => onDeleteReceipt(receipt)}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-neutral-200 px-3 text-[12px] font-semibold text-neutral-500 transition hover:border-red-100 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Delete ${label}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-[13px] text-neutral-400">
          No bills here yet.
        </div>
      )}
    </div>
  );
}
