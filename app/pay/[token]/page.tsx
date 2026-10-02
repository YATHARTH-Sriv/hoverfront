"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import CustomWalletButton from "@/components/customwalletbutton";
import { apiRequest, base64ToBytes, bytesToBase64 } from "@/components/Dashboard/helperfns";
import type { InvoiceRecord, SendTransactionResponse } from "@/types";

type PublicInvoice = {
  invoice: InvoiceRecord;
  workspaceName: string;
  smartAccountName: string;
  recipient: string;
};

function sol(value: string | number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 9 }).format(Number(value))} SOL`;
}

export default function PayInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { publicKey, signTransaction } = useWallet();
  const [data, setData] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await apiRequest<PublicInvoice>(`/public/invoices/${token}`);
      setData(response);
      const remaining = Math.max(
        0,
        Number(response.invoice.total) - Number(response.invoice.amountPaid),
      );
      setAmount(String(remaining));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This invoice is unavailable");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const remaining = useMemo(
    () => Math.max(0, Number(data?.invoice.total ?? 0) - Number(data?.invoice.amountPaid ?? 0)),
    [data],
  );

  async function pay() {
    if (!data || !publicKey || !signTransaction) return;
    try {
      setPaying(true);
      setError("");
      const built = await apiRequest<{
        transactionBase64: string;
        amountLamports: string;
      }>(`/public/invoices/${token}/payment/build`, {
        method: "POST",
        body: JSON.stringify({ payerWallet: publicKey.toBase58(), amount }),
      });
      const transaction = Transaction.from(base64ToBytes(built.transactionBase64));
      const signed = await signTransaction(transaction);
      const sent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signed.serialize()) }),
      });
      const settled = await apiRequest<PublicInvoice>(
        `/public/invoices/${token}/payment/submitted`,
        {
          method: "POST",
          body: JSON.stringify({
            payerWallet: publicKey.toBase58(),
            amountLamports: built.amountLamports,
            txSig: sent.txSig,
          }),
        },
      );
      setData(settled);
      setAmount(
        String(Math.max(0, Number(settled.invoice.total) - Number(settled.invoice.amountPaid))),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be completed");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100">
        <Loader2 className="animate-spin text-neutral-500" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-5">
        <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-[20px] font-semibold">Invoice unavailable</h1>
          <p className="mt-2 text-[13px] text-neutral-500">{error}</p>
        </div>
      </main>
    );
  }

  const paid = data.invoice.status === "PAID";

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="flex items-start justify-between gap-5 border-b border-neutral-200 pb-7">
            <div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-950 text-[14px] font-bold text-white">
                H
              </div>
              <h1 className="mt-4 text-[22px] font-semibold">{data.workspaceName}</h1>
              <p className="mt-1 text-[12px] text-neutral-500">Invoice issued in SOL</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase text-neutral-400">Invoice</p>
              <p className="mt-1 font-mono text-[14px] font-semibold">
                INV-{String(data.invoice.invoiceNumber).padStart(5, "0")}
              </p>
              <p className="mt-4 text-[12px] text-neutral-500">{data.invoice.issueDate}</p>
              {data.invoice.dueDate && (
                <p className="mt-1 text-[12px] text-neutral-500">Due {data.invoice.dueDate}</p>
              )}
            </div>
          </div>
          <div className="grid gap-6 border-b border-neutral-200 py-7 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase text-neutral-400">Bill to</p>
              <p className="mt-2 text-[15px] font-semibold">{data.invoice.customerBusinessName}</p>
              <p className="mt-1 text-[12px] text-neutral-500">
                {data.invoice.customerBillingEmail}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase text-neutral-400">Payable to</p>
              <p className="mt-2 text-[15px] font-semibold">{data.smartAccountName}</p>
              <p className="mt-1 font-mono text-[11px] text-neutral-500">
                {data.recipient.slice(0, 8)}...{data.recipient.slice(-8)}
              </p>
            </div>
          </div>
          <div className="py-7">
            <div className="grid grid-cols-[minmax(0,1fr)_70px_100px] gap-3 border-b border-neutral-200 pb-2 text-[10px] font-semibold uppercase text-neutral-400 sm:grid-cols-[minmax(0,1fr)_70px_100px_100px]">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Price</span>
              <span className="hidden text-right sm:block">Amount</span>
            </div>
            {data.invoice.lineItems.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[minmax(0,1fr)_70px_100px] gap-3 border-b border-neutral-100 py-3 text-[12px] sm:grid-cols-[minmax(0,1fr)_70px_100px_100px]"
              >
                <span className="font-medium">{line.description}</span>
                <span className="text-right text-neutral-500">{Number(line.quantity)}</span>
                <span className="text-right text-neutral-500">{Number(line.unitPrice)}</span>
                <span className="hidden text-right font-medium sm:block">
                  {sol(line.amount ?? 0)}
                </span>
              </div>
            ))}
          </div>
          {data.invoice.memo && (
            <div className="border-t border-neutral-200 pt-5">
              <p className="text-[11px] font-semibold uppercase text-neutral-400">Memo</p>
              <p className="mt-2 text-[12px] leading-5 text-neutral-600">{data.invoice.memo}</p>
            </div>
          )}
        </article>

        <aside className="h-fit rounded-xl border border-neutral-200 bg-white p-5 shadow-sm lg:sticky lg:top-8">
          {paid ? (
            <div className="py-5 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
              <h2 className="mt-4 text-[18px] font-semibold">Invoice paid</h2>
              <p className="mt-1 text-[13px] text-neutral-500">
                Settlement is confirmed on Solana.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[12px] font-medium text-neutral-500">Remaining balance</p>
              <p className="mt-1 text-[27px] font-semibold">{sol(remaining)}</p>
              <div className="mt-5 grid grid-cols-2 gap-2 border-y border-neutral-100 py-4 text-[12px]">
                <div>
                  <p className="text-neutral-400">Total</p>
                  <p className="mt-1 font-semibold">{sol(data.invoice.total)}</p>
                </div>
                <div>
                  <p className="text-neutral-400">Paid</p>
                  <p className="mt-1 font-semibold">{sol(data.invoice.amountPaid)}</p>
                </div>
              </div>
              <label className="mt-5 block text-[12px] font-semibold text-neutral-700">
                Payment amount
                <div className="mt-2 flex h-11 items-center rounded-lg border border-neutral-200 px-3 focus-within:ring-2 focus-within:ring-neutral-950">
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 text-[14px] outline-none"
                  />
                  <span className="text-[12px] font-semibold text-neutral-400">SOL</span>
                </div>
              </label>
              <div className="mt-4">
                <CustomWalletButton />
              </div>
              <button
                type="button"
                onClick={() => void pay()}
                disabled={
                  !publicKey ||
                  !signTransaction ||
                  paying ||
                  Number(amount) <= 0 ||
                  Number(amount) > remaining
                }
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-neutral-950 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {paying && <Loader2 className="animate-spin" size={15} />}
                {paying ? "Confirming payment" : "Pay with wallet"}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
                <ShieldCheck size={13} /> Verified on Solana before settlement
              </p>
            </>
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
