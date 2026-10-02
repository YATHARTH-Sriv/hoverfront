"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  FilePlus2,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { apiRequest } from "./helperfns";
import type { CustomerRecord, InvoiceLineItem, InvoiceRecord, SettingsAccount } from "@/types";

type Mode = "list" | "create" | "detail";
type DraftLine = InvoiceLineItem & { key: string };

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): DraftLine => ({
  key: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unitPrice: "",
});

function displaySol(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0 SOL";
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 9,
  }).format(amount)} SOL`;
}

function lineAmount(line: InvoiceLineItem) {
  const value = Number(line.quantity) * Number(line.unitPrice);
  return Number.isFinite(value) ? value : 0;
}

function compactDecimal(value: string | number) {
  const text = String(value).trim();
  if (!text.includes(".")) return text;
  return text.replace(/0+$/, "").replace(/\.$/, "") || "0";
}

function invoiceLabel(number: number) {
  return `INV-${String(number).padStart(5, "0")}`;
}

function transactionExplorerUrl(signature: string) {
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8899";
  const lowerRpcUrl = rpcUrl.toLowerCase();
  const base = `https://explorer.solana.com/tx/${signature}`;
  if (lowerRpcUrl.includes("devnet")) return `${base}?cluster=devnet`;
  if (lowerRpcUrl.includes("testnet")) return `${base}?cluster=testnet`;
  if (lowerRpcUrl.includes("mainnet")) return base;
  return `${base}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl)}`;
}

export function InvoiceWorkspace({
  settingsAccount,
  walletAddress,
  onError,
}: {
  settingsAccount: SettingsAccount;
  walletAddress: string;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("list");
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingInvoice, setRefreshingInvoice] = useState(false);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [smartAccountId, setSmartAccountId] = useState(settingsAccount.smartAccounts[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const query = useMemo(
    () =>
      `walletAddress=${encodeURIComponent(walletAddress)}&settingsPda=${encodeURIComponent(settingsAccount.pda)}`,
    [settingsAccount.pda, walletAddress],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [customerData, invoiceData] = await Promise.all([
        apiRequest<{ customers: CustomerRecord[] }>(`/customers?${query}`),
        apiRequest<{ invoices: InvoiceRecord[] }>(`/invoices?${query}`),
      ]);
      setCustomers(customerData.customers);
      setInvoices(invoiceData.invoices);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [onError, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const customer = customers.find((item) => item.id === customerId);
  const smartAccount = settingsAccount.smartAccounts.find((item) => item.id === smartAccountId);
  const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const validLines = lines.every(
    (line) => line.description.trim() && Number(line.quantity) > 0 && Number(line.unitPrice) >= 0,
  );
  const canSave = Boolean(customerId && smartAccountId && issueDate && validLines && lines.length);

  const filteredInvoices = invoices.filter((invoice) => {
    const term = search.trim().toLowerCase();
    return (
      !term ||
      invoice.customerBusinessName.toLowerCase().includes(term) ||
      invoiceLabel(invoice.invoiceNumber).toLowerCase().includes(term)
    );
  });

  function resetDraft() {
    setEditingInvoice(null);
    setCustomerId("");
    setSmartAccountId(settingsAccount.smartAccounts[0]?.id ?? "");
    setIssueDate(today());
    setDueDate("");
    setMemo("");
    setLines([emptyLine()]);
  }

  function editDraft(invoice: InvoiceRecord) {
    setEditingInvoice(invoice);
    setCustomerId(invoice.customerId);
    setSmartAccountId(invoice.receivingSmartAccountId);
    setIssueDate(invoice.issueDate);
    setDueDate(invoice.dueDate ?? "");
    setMemo(invoice.memo ?? "");
    setLines(
      invoice.lineItems.map((line) => ({
        ...line,
        quantity: compactDecimal(line.quantity),
        unitPrice: compactDecimal(line.unitPrice),
        key: line.id ?? crypto.randomUUID(),
      })),
    );
    setMode("create");
  }

  function updateLine(key: string, field: keyof InvoiceLineItem, value: string) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, [field]: value } : line)),
    );
  }

  async function saveDraft() {
    if (!canSave) return;
    try {
      setSaving(true);
      const response = await apiRequest<{ invoice: InvoiceRecord }>(
        editingInvoice ? `/invoices/${editingInvoice.id}` : "/invoices",
        {
          method: editingInvoice ? "PATCH" : "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            customerId,
            receivingSmartAccountId: smartAccountId,
            issueDate,
            dueDate: dueDate || null,
            memo: memo || null,
            lineItems: lines.map(({ description, quantity, unitPrice }) => ({
              description: description.trim(),
              quantity,
              unitPrice,
            })),
          }),
        },
      );
      setInvoices((current) =>
        editingInvoice
          ? current.map((item) => (item.id === response.invoice.id ? response.invoice : item))
          : [response.invoice, ...current],
      );
      setSelectedInvoice(response.invoice);
      setMode("detail");
      resetDraft();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save invoice");
    } finally {
      setSaving(false);
    }
  }

  async function createCustomer() {
    if (!customerName.trim()) return;
    try {
      setSaving(true);
      const response = await apiRequest<{ customer: CustomerRecord }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          settingsPda: settingsAccount.pda,
          businessName: customerName.trim(),
          billingEmail: customerEmail.trim() || null,
        }),
      });
      setCustomers((current) => [...current, response.customer]);
      setCustomerId(response.customer.id);
      setCustomerName("");
      setCustomerEmail("");
      setShowCustomerForm(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not add customer");
    } finally {
      setSaving(false);
    }
  }

  async function removeDraft(invoice: InvoiceRecord) {
    try {
      await apiRequest(`/invoices/${invoice.id}`, {
        method: "DELETE",
        body: JSON.stringify({ walletAddress, settingsPda: settingsAccount.pda }),
      });
      setInvoices((current) => current.filter((item) => item.id !== invoice.id));
      setSelectedInvoice(null);
      setMode("list");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete invoice");
    }
  }

  async function openInvoice(invoice: InvoiceRecord) {
    try {
      const response = await apiRequest<{ invoice: InvoiceRecord }>(
        `/invoices/${invoice.id}?${query}`,
      );
      setSelectedInvoice(response.invoice);
      setMode("detail");
      setPublicUrl("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not load invoice");
    }
  }

  async function refreshInvoice(invoice: InvoiceRecord) {
    try {
      setRefreshingInvoice(true);
      const response = await apiRequest<{ invoice: InvoiceRecord }>(
        `/invoices/${invoice.id}?${query}`,
      );
      setSelectedInvoice(response.invoice);
      setInvoices((current) =>
        current.map((item) => (item.id === response.invoice.id ? response.invoice : item)),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not refresh settlement");
    } finally {
      setRefreshingInvoice(false);
    }
  }

  async function sendInvoice(invoice: InvoiceRecord) {
    try {
      setSaving(true);
      const response = await apiRequest<{ invoice: InvoiceRecord; publicUrl: string }>(
        `/invoices/${invoice.id}/send`,
        {
          method: "POST",
          body: JSON.stringify({ walletAddress, settingsPda: settingsAccount.pda }),
        },
      );
      setSelectedInvoice(response.invoice);
      setInvoices((current) =>
        current.map((item) => (item.id === response.invoice.id ? response.invoice : item)),
      );
      setPublicUrl(response.publicUrl);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not create invoice link");
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (loading) {
    return (
      <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-72 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    );
  }

  if (mode === "create") {
    return (
      <section className="mt-8 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to invoices"
              onClick={() => setMode("list")}
              className="flex size-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold">
                {editingInvoice
                  ? `Edit ${invoiceLabel(editingInvoice.invoiceNumber)}`
                  : "New invoice"}
              </h2>
              <p className="text-[13px] text-neutral-500">Prepare and save a customer invoice.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={!canSave || saving}
            className="flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 className="animate-spin" size={15} />}
            {editingInvoice ? "Save changes" : "Save draft"}
          </button>
        </div>

        <div className="grid xl:grid-cols-[minmax(420px,0.88fr)_minmax(500px,1.12fr)]">
          <div className="space-y-7 border-b border-neutral-200 p-5 xl:border-r xl:border-b-0 xl:p-7">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-neutral-700">Customer</span>
                <button
                  type="button"
                  onClick={() => setShowCustomerForm((current) => !current)}
                  className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold hover:bg-white focus-visible:ring-2 focus-visible:ring-neutral-950"
                >
                  <Plus size={14} /> Add customer
                </button>
              </div>
              <select
                aria-label="Customer"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
              >
                <option value="">Select customer</option>
                {customers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.businessName}
                  </option>
                ))}
              </select>
              {!customers.length && (
                <p className="mt-2 text-[12px] text-amber-700">
                  Add a customer before creating an invoice.
                </p>
              )}
              {showCustomerForm && (
                <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-[12px] font-medium text-neutral-600">
                      Business name
                      <input
                        autoFocus
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Redwood Holdings"
                        className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                      />
                    </label>
                    <label className="text-[12px] font-medium text-neutral-600">
                      Billing email
                      <input
                        type="email"
                        autoComplete="email"
                        value={customerEmail}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                        placeholder="billing@customer.com"
                        className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomerForm(false)}
                      className="h-10 rounded-lg px-3 text-[13px] font-semibold text-neutral-600 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-950"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void createCustomer()}
                      disabled={!customerName.trim() || saving}
                      className="h-10 rounded-lg bg-neutral-950 px-3 text-[13px] font-semibold text-white focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:opacity-40"
                    >
                      Add customer
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Receive into">
                <select
                  value={smartAccountId}
                  onChange={(event) => setSmartAccountId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                >
                  {settingsAccount.smartAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <div className="flex h-11 items-center rounded-lg border border-neutral-200 bg-neutral-100 px-3 text-[14px] font-semibold">
                  SOL
                </div>
              </Field>
              <Field label="Issue date">
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                />
              </Field>
              <Field label="Due date" optional>
                <input
                  type="date"
                  min={issueDate}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                />
              </Field>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold">Line items</h3>
                <button
                  type="button"
                  onClick={() => setLines((current) => [...current, emptyLine()])}
                  className="flex h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold hover:bg-white focus-visible:ring-2 focus-visible:ring-neutral-950"
                >
                  <Plus size={15} /> Add item
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={line.key} className="rounded-lg border border-neutral-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-neutral-500">
                        Item {index + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove item ${index + 1}`}
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) => current.filter((item) => item.key !== line.key))
                        }
                        className="flex size-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-25"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <label className="block text-[12px] font-medium text-neutral-600">
                      Description
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(line.key, "description", e.target.value)}
                        placeholder="Design services"
                        className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                      />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-[12px] font-medium text-neutral-600">
                        Quantity
                        <input
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, "quantity", e.target.value)}
                          className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                        />
                      </label>
                      <label className="text-[12px] font-medium text-neutral-600">
                        Price in SOL
                        <input
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.key, "unitPrice", e.target.value)}
                          placeholder="0.00"
                          className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Memo" optional>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                placeholder="Payment terms or a short note"
                className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-[14px] focus-visible:ring-2 focus-visible:ring-neutral-950"
              />
            </Field>
          </div>

          <div className="bg-neutral-100 p-4 sm:p-8 xl:p-10">
            <InvoiceDocument
              workspaceName={settingsAccount.name}
              customerName={customer?.businessName}
              customerEmail={customer?.billingEmail}
              smartAccountName={smartAccount?.name}
              issueDate={issueDate}
              dueDate={dueDate}
              lines={lines}
              total={total}
              memo={memo}
            />
          </div>
        </div>
      </section>
    );
  }

  if (mode === "detail" && selectedInvoice) {
    return (
      <section className="mt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Back to invoices"
              onClick={() => setMode("list")}
              className="flex size-10 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-950"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h2 className="text-[18px] font-semibold">
                {invoiceLabel(selectedInvoice.invoiceNumber)}
              </h2>
              <p className="text-[13px] text-neutral-500">
                {selectedInvoice.status.toLowerCase().replaceAll("_", " ")} for{" "}
                {selectedInvoice.customerBusinessName}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshInvoice(selectedInvoice)}
              disabled={refreshingInvoice}
              className="flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-950 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshingInvoice ? "animate-spin" : undefined} />
              {refreshingInvoice ? "Refreshing" : "Refresh"}
            </button>
            {selectedInvoice.status !== "PAID" && selectedInvoice.status !== "VOID" && (
              <button
                type="button"
                onClick={() => void sendInvoice(selectedInvoice)}
                disabled={saving}
                className="flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                {selectedInvoice.status === "DRAFT" ? "Send invoice" : "New payment link"}
              </button>
            )}
            {selectedInvoice.status === "DRAFT" && (
              <>
                <button
                  type="button"
                  onClick={() => editDraft(selectedInvoice)}
                  className="h-10 rounded-lg bg-neutral-950 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
                >
                  Edit draft
                </button>
                <button
                  type="button"
                  onClick={() => void removeDraft(selectedInvoice)}
                  className="flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-[13px] font-semibold text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <Trash2 size={15} />
                  Delete draft
                </button>
              </>
            )}
          </div>
        </div>
        {publicUrl && (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-emerald-900">Payment link ready</p>
              <p className="mt-0.5 truncate text-[12px] text-emerald-700">{publicUrl}</p>
            </div>
            <button
              type="button"
              onClick={() => void copyPublicUrl()}
              className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-[12px] font-semibold text-emerald-900 hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
        {selectedInvoice.status !== "DRAFT" && (
          <div className="mb-5 grid gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
            <SettlementMetric label="Invoice total" value={displaySol(selectedInvoice.total)} />
            <SettlementMetric label="Settled" value={displaySol(selectedInvoice.amountPaid)} />
            <SettlementMetric
              label="Remaining"
              value={displaySol(
                Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.amountPaid)),
              )}
            />
          </div>
        )}
        <div className="mx-auto max-w-3xl rounded-xl bg-neutral-100 p-4 sm:p-8">
          <InvoiceDocument
            workspaceName={settingsAccount.name}
            invoiceNumber={selectedInvoice.invoiceNumber}
            customerName={selectedInvoice.customerBusinessName}
            customerEmail={selectedInvoice.customerBillingEmail}
            smartAccountName={
              settingsAccount.smartAccounts.find(
                (account) => account.id === selectedInvoice.receivingSmartAccountId,
              )?.name
            }
            issueDate={selectedInvoice.issueDate}
            dueDate={selectedInvoice.dueDate ?? ""}
            lines={selectedInvoice.lineItems}
            total={Number(selectedInvoice.total)}
            memo={selectedInvoice.memo ?? ""}
          />
        </div>
        {selectedInvoice.payments.length > 0 && (
          <div className="mx-auto mt-5 max-w-3xl overflow-hidden rounded-xl border border-neutral-200">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h3 className="text-[13px] font-semibold">Settlement history</h3>
            </div>
            <div className="divide-y divide-neutral-100">
              {selectedInvoice.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="grid gap-2 px-4 py-3 text-[12px] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-5"
                >
                  <div className="min-w-0">
                    <a
                      href={transactionExplorerUrl(payment.txSig)}
                      target="_blank"
                      rel="noreferrer"
                      title={payment.txSig}
                      className="inline-flex max-w-full items-center gap-1.5 font-semibold text-neutral-800 hover:text-neutral-500 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-neutral-950"
                    >
                      <span className="truncate font-mono">
                        {payment.txSig.slice(0, 12)}...{payment.txSig.slice(-8)}
                      </span>
                      <ExternalLink className="shrink-0" size={13} />
                      <span className="sr-only">Open transaction in Solana Explorer</span>
                    </a>
                    <p className="mt-0.5 text-neutral-400">
                      {new Date(payment.confirmedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="font-mono text-neutral-500">
                    {payment.payerWallet.slice(0, 6)}...{payment.payerWallet.slice(-6)}
                  </span>
                  <span className="font-semibold">
                    {displaySol(Number(payment.amountLamports) / 1_000_000_000)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold">Invoices</h2>
          <p className="mt-1 text-[13px] text-neutral-500">
            Draft and review invoices issued from this workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode("create")}
          className="flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-[13px] font-semibold text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
        >
          <FilePlus2 size={16} />
          New invoice
        </button>
      </div>
      <div className="mb-4 flex h-11 max-w-sm items-center gap-2 rounded-lg border border-neutral-200 px-3 focus-within:ring-2 focus-within:ring-neutral-950">
        <Search size={16} className="text-neutral-400" />
        <input
          aria-label="Search invoices"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer or invoice"
          className="min-w-0 flex-1 text-[14px] focus:outline-none"
        />
      </div>
      {!filteredInvoices.length ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-6 text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-neutral-100">
            <FilePlus2 size={19} />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold">
            {search ? "No matching invoices" : "No invoices yet"}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] text-neutral-500">
            {search
              ? "Try another customer or invoice number."
              : "Create the first draft and keep customer, amount, and receiving account together."}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => setMode("create")}
              className="mt-5 h-10 rounded-lg bg-neutral-950 px-4 text-[13px] font-semibold text-white focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
            >
              Create invoice
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <div className="hidden grid-cols-[1fr_1.6fr_1fr_1fr_40px] gap-4 bg-neutral-50 px-4 py-3 text-[11px] font-semibold uppercase text-neutral-500 md:grid">
            <span>Invoice</span>
            <span>Customer</span>
            <span>Status</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <div className="divide-y divide-neutral-100">
            {filteredInvoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => void openInvoice(invoice)}
                className="grid min-h-18 w-full gap-2 px-4 py-4 text-left hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-950 md:grid-cols-[1fr_1.6fr_1fr_1fr_40px] md:items-center md:gap-4"
              >
                <span className="text-[13px] font-semibold">
                  {invoiceLabel(invoice.invoiceNumber)}
                </span>
                <span className="text-[13px] text-neutral-700">{invoice.customerBusinessName}</span>
                <span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
                    {invoice.status.toLowerCase()}
                  </span>
                </span>
                <span className="text-[13px] font-semibold md:text-right">
                  {displaySol(invoice.total)}
                </span>
                <ChevronRight size={16} className="hidden text-neutral-400 md:block" />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function SettlementMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-medium text-neutral-400">{label}</p>
      <p className="mt-1 text-[14px] font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[12px] font-semibold text-neutral-700">
      <span className="mb-2 flex items-center justify-between">
        <span>{label}</span>
        {optional && <span className="font-normal text-neutral-400">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function InvoiceDocument({
  workspaceName,
  invoiceNumber,
  customerName,
  customerEmail,
  smartAccountName,
  issueDate,
  dueDate,
  lines,
  total,
  memo,
}: {
  workspaceName: string;
  invoiceNumber?: number;
  customerName?: string;
  customerEmail?: string | null;
  smartAccountName?: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLineItem[];
  total: number;
  memo: string;
}) {
  return (
    <article className="mx-auto min-h-180 w-full max-w-180 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm sm:p-9">
      <div className="flex items-start justify-between gap-5 border-b border-neutral-200 pb-7">
        <div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-950 text-[14px] font-bold text-white">
            H
          </div>
          <h2 className="mt-4 text-[20px] font-semibold">{workspaceName}</h2>
          <p className="mt-1 text-[12px] text-neutral-500">Invoice issued in SOL</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase text-neutral-400">Invoice</p>
          <p className="mt-1 font-mono text-[14px] font-semibold">
            {invoiceNumber ? invoiceLabel(invoiceNumber) : "Draft"}
          </p>
          <p className="mt-4 flex items-center justify-end gap-1.5 text-[12px] text-neutral-500">
            <CalendarDays size={13} />
            {issueDate || "Issue date"}
          </p>
          {dueDate && <p className="mt-1 text-[12px] text-neutral-500">Due {dueDate}</p>}
        </div>
      </div>
      <div className="grid gap-6 border-b border-neutral-200 py-7 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-neutral-400">Bill to</p>
          <p className="mt-2 text-[15px] font-semibold">{customerName || "Select a customer"}</p>
          <p className="mt-1 text-[12px] text-neutral-500">
            {customerEmail || "Customer billing details"}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase text-neutral-400">Payable to</p>
          <p className="mt-2 text-[15px] font-semibold">
            {smartAccountName || "Select an account"}
          </p>
          <p className="mt-1 text-[12px] text-neutral-500">Hover smart account</p>
        </div>
      </div>
      <div className="py-7">
        <div className="grid grid-cols-[minmax(0,1fr)_55px_90px] gap-3 border-b border-neutral-200 pb-2 text-[10px] font-semibold uppercase text-neutral-400 sm:grid-cols-[minmax(0,1fr)_70px_100px_100px]">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Price</span>
          <span className="hidden text-right sm:block">Amount</span>
        </div>
        <div className="divide-y divide-neutral-100">
          {lines.map((line, index) => (
            <div
              key={line.id ?? index}
              className="grid grid-cols-[minmax(0,1fr)_55px_90px] gap-3 py-3 text-[12px] sm:grid-cols-[minmax(0,1fr)_70px_100px_100px]"
            >
              <span className="truncate font-medium">{line.description || "Untitled item"}</span>
              <span className="text-right text-neutral-500">
                {compactDecimal(line.quantity || "0")}
              </span>
              <span className="text-right text-neutral-500">
                {displaySol(line.unitPrice || 0).replace(" SOL", "")}
              </span>
              <span className="hidden text-right font-medium sm:block">
                {displaySol(line.amount ?? lineAmount(line))}
              </span>
            </div>
          ))}
        </div>
        <div className="ml-auto mt-6 w-full max-w-64 border-t border-neutral-950 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">Total</span>
            <span className="text-[17px] font-semibold">{displaySol(total)}</span>
          </div>
        </div>
      </div>
      {memo && (
        <div className="mt-6 border-t border-neutral-200 pt-5">
          <p className="text-[11px] font-semibold uppercase text-neutral-400">Memo</p>
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-neutral-600">{memo}</p>
        </div>
      )}
    </article>
  );
}
