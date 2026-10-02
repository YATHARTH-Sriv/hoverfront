"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Copy,
  Edit3,
  FileText,
  HandCoins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Shield,
  UserPlus,
} from "lucide-react";
import { grotesk } from "@/fonts";
import {
  SmartAccountTab,
  DashboardResponse,
  ActiveSection,
  AddSignerSubmittedResponse,
  WalletSubmittedResponse,
  SendTransactionResponse,
  BuildSignedTransactionResponse,
  SmartAccountResponse,
  ReceiptRecord,
  TransactionRecord,
} from "@/types";
import { DashboardToast } from "@/components/Dashboard/Dashboardtoast";
import {
  avatarColor,
  formatSol,
  initials,
  PermissionChips,
  shortAddress,
  TextField,
} from "@/components/Dashboard/helpers";
import {
  apiRequest,
  base64ToBytes,
  bytesToBase64,
  totalBalance,
} from "@/components/Dashboard/helperfns";
import { SidebarItem } from "@/components/Dashboard/Sidebaritem";
import { SmartAccountSubnav } from "@/components/Dashboard/SmartaccountSubnav";
import { ActivityList, SignerList } from "@/components/Dashboard/List";
import { SelectedSmartAccountView } from "@/components/Dashboard/Selectedsmartaccount";
import { Panel } from "@/components/Dashboard/Panel";
import { SmartAccountCard } from "@/components/Dashboard/SmartAccountcard";
import { TransactionList } from "@/components/Dashboard/Txnlist";
import {
  AddSignerModal,
  CreateTransactionModal,
  ReceiptPreviewModal,
} from "@/components/Dashboard/Modal";
import { FloatingDashboardChat } from "@/components/Dashboard/Floatingchat";
import { InvoiceWorkspace } from "@/components/Dashboard/InvoiceWorkspace";
import { PayoutWorkspace } from "@/components/Dashboard/PayoutWorkspace";

export default function DashboardPage() {
  const { publicKey, connected, signTransaction, disconnect } = useWallet();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [smartAccountName, setSmartAccountName] = useState("Main vault");
  const [recipient, setRecipient] = useState("");
  const [paymentAmountSol, setPaymentAmountSol] = useState("");
  const [paymentMemo, setPaymentMemo] = useState("");
  const [selectedSmartAccountId, setSelectedSmartAccountId] = useState("");
  const [selectedSmartAccountTab, setSelectedSmartAccountTab] =
    useState<SmartAccountTab>("overview");
  const [newThreshold, setNewThreshold] = useState("");
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [showSignerModal, setShowSignerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptRecord | null>(null);
  const [receiptForPayment, setReceiptForPayment] = useState<ReceiptRecord | null>(null);
  const [signerStep, setSignerStep] = useState(0);
  const [signerAddress, setSignerAddress] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerDesignation, setSignerDesignation] = useState("");
  const [signerPermissions, setSignerPermissions] = useState("7");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");

  const walletAddress = publicKey?.toBase58() ?? "";

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5200);
    return () => window.clearTimeout(timer);
  }, [error]);

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (!walletAddress) return;
      try {
        setLoading(true);
        setError("");
        const data = await apiRequest<DashboardResponse>(
          `/dashboard?walletAddress=${encodeURIComponent(walletAddress)}&refresh=${refresh ? "true" : "false"}`,
        );
        setDashboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dashboard fetch failed");
      } finally {
        setLoading(false);
      }
    },
    [walletAddress],
  );

  useEffect(() => {
    if (!walletAddress) return;
    const timer = window.setTimeout(() => {
      void loadDashboard(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard, walletAddress]);

  const settingsAccount = dashboard?.settings?.[0];

  const treasuryBalance = useMemo(() => totalBalance(settingsAccount), [settingsAccount]);

  const currentSigner = useMemo(
    () => settingsAccount?.signers.find((signer) => signer.walletAddress === walletAddress),
    [settingsAccount, walletAddress],
  );

  const walletDisplayName =
    currentSigner?.name ||
    currentSigner?.label ||
    currentSigner?.walletLabel ||
    settingsAccount?.name ||
    "Wallet";

  const walletSubtitle =
    currentSigner?.designation ||
    currentSigner?.email ||
    currentSigner?.role ||
    (walletAddress ? shortAddress(walletAddress) : "");

  const nextSmartAccountIndex = useMemo(() => {
    const indexes = settingsAccount?.smartAccounts.map((account) => account.accountIndex) ?? [];
    if (!indexes.length) return 0;
    return Math.max(...indexes) + 1;
  }, [settingsAccount]);

  const selectedSmartAccount = settingsAccount?.smartAccounts.find(
    (account) => account.id === selectedSmartAccountId,
  );

  const paymentSmartAccount = selectedSmartAccount ?? settingsAccount?.smartAccounts?.[0];

  const selectedSmartAccountTransactions = useMemo(() => {
    if (!settingsAccount || !selectedSmartAccount) return [];
    return settingsAccount.transactions.filter(
      (transaction) =>
        transaction.smartAccountId === selectedSmartAccount.id ||
        transaction.smartAccountPda === selectedSmartAccount.pda ||
        transaction.accountIndex === selectedSmartAccount.accountIndex,
    );
  }, [settingsAccount, selectedSmartAccount]);

  const payoutTransactions = useMemo(
    () => settingsAccount?.transactions.filter((transaction) => Boolean(transaction.payout)) ?? [],
    [settingsAccount],
  );

  const otherTransactions = useMemo(
    () => settingsAccount?.transactions.filter((transaction) => !transaction.payout) ?? [],
    [settingsAccount],
  );

  const selectedSmartAccountReceipts = useMemo(() => {
    if (!settingsAccount || !selectedSmartAccount) return [];
    return (settingsAccount.receipts ?? []).filter(
      (receipt) =>
        receipt.smartAccountId === selectedSmartAccount.id && receipt.status !== "ARCHIVED",
    );
  }, [settingsAccount, selectedSmartAccount]);

  const selectedSmartAccountReviewReceipts = useMemo(
    () =>
      selectedSmartAccountReceipts.filter(
        (receipt) => !["PAYMENT_PREPARED", "PAID", "ARCHIVED"].includes(receipt.status),
      ),
    [selectedSmartAccountReceipts],
  );

  useEffect(() => {
    if (!settingsAccount) return;
    const timer = window.setTimeout(() => {
      setNewThreshold((current) => current || String(settingsAccount.threshold));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [settingsAccount]);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied(""), 900);
  }

  async function createSmartAccount() {
    if (!settingsAccount) return;
    try {
      setActing("smart-account");
      setError("");
      await apiRequest<SmartAccountResponse>("/smart-accounts", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          settingsPda: settingsAccount.pda,
          name: smartAccountName,
          accountIndex: nextSmartAccountIndex,
        }),
      });
      setSmartAccountName("");
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Smart account creation failed");
    } finally {
      setActing("");
    }
  }

  async function changeThreshold() {
    if (!settingsAccount || !signTransaction) return;
    try {
      setActing("threshold");
      setError("");
      const built = await apiRequest<BuildSignedTransactionResponse>(
        "/settings/change-threshold/build",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            newThreshold: Number(newThreshold),
            memo: "Dashboard threshold update",
          }),
        },
      );
      const transaction = Transaction.from(base64ToBytes(built.transactionBase64));
      const signed = await signTransaction(transaction);
      const sent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signed.serialize()) }),
      });
      await apiRequest("/settings/change-threshold/submitted", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          settingsPda: settingsAccount.pda,
          newThreshold: Number(newThreshold),
          txSig: sent.txSig,
        }),
      });
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Threshold update failed");
    } finally {
      setActing("");
    }
  }

  async function addSigner() {
    if (!settingsAccount || !signTransaction) return;
    try {
      setActing("add-signer");
      setError("");
      const built = await apiRequest<BuildSignedTransactionResponse>("/settings/add-signer/build", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          settingsPda: settingsAccount.pda,
          signer: signerAddress,
          permissionsMask: Number(signerPermissions),
          memo: `Add ${signerName || "teammate"} as signer`,
        }),
      });
      const transaction = Transaction.from(base64ToBytes(built.transactionBase64));
      const signed = await signTransaction(transaction);
      const sent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signed.serialize()) }),
      });
      const submitted = await apiRequest<AddSignerSubmittedResponse>(
        "/settings/add-signer/submitted",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            signer: signerAddress,
            name: signerName,
            email: signerEmail,
            designation: signerDesignation,
            permissionsMask: Number(signerPermissions),
            txSig: sent.txSig,
          }),
        },
      );
      const inviteLink = submitted.invite?.inviteUrl ?? "";
      await loadDashboard(true);
      if (inviteLink) {
        setLatestInviteUrl(inviteLink);
        setSignerStep(2);
      } else {
        setSignerAddress("");
        setSignerName("");
        setSignerEmail("");
        setSignerDesignation("");
        setSignerPermissions("7");
        setSignerStep(0);
        setShowSignerModal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add signer failed");
    } finally {
      setActing("");
    }
  }

  async function createPayment() {
    if (!settingsAccount || !paymentSmartAccount || !signTransaction) return;
    try {
      setActing("payment");
      setError("");
      const amountLamports = Math.round(Number(paymentAmountSol) * LAMPORTS_PER_SOL);
      const createBuild = await apiRequest<BuildSignedTransactionResponse>(
        "/transactions/build-create",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            accountIndex: paymentSmartAccount.accountIndex,
            recipient,
            amountLamports: String(amountLamports),
            memo: paymentMemo || "Dashboard payment",
            smartAccountName: paymentSmartAccount.name,
          }),
        },
      );
      const createTx = Transaction.from(base64ToBytes(createBuild.transactionBase64));
      const signedCreateTx = await signTransaction(createTx);
      const sentCreate = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedCreateTx.serialize()) }),
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
      const proposalTx = Transaction.from(base64ToBytes(proposalBuild.transactionBase64));
      const signedProposalTx = await signTransaction(proposalTx);
      const sentProposal = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedProposalTx.serialize()) }),
      });

      const submitted = await apiRequest<WalletSubmittedResponse>(
        "/transactions/wallet-submitted",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            recipient,
            accountIndex: paymentSmartAccount.accountIndex,
            transactionIndex: createBuild.transactionIndex,
            transactionPda: createBuild.transactionPda,
            proposalPda: proposalBuild.proposalPda,
            smartAccountPda: createBuild.smartAccountPda,
            amountLamports: String(amountLamports),
            memo: paymentMemo || "Dashboard payment",
            smartAccountName: paymentSmartAccount.name,
            createTxSig: sentCreate.txSig,
            proposalTxSig: sentProposal.txSig,
          }),
        },
      );
      if (receiptForPayment?.id && submitted.transaction?.id) {
        await apiRequest(`/receipts/${receiptForPayment.id}/payment-submitted`, {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            transactionRecordId: submitted.transaction.id,
          }),
        });
      }

      setRecipient("");
      setPaymentAmountSol("");
      setPaymentMemo("");
      setReceiptForPayment(null);
      setShowPaymentModal(false);
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment transaction creation failed");
    } finally {
      setActing("");
    }
  }

  async function deleteReceipt(receipt: ReceiptRecord) {
    try {
      setActing(`delete-${receipt.id}`);
      setError("");
      await apiRequest(`/receipts/${receipt.id}`, {
        method: "DELETE",
        body: JSON.stringify({ walletAddress }),
      });
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete bill");
    } finally {
      setActing("");
    }
  }

  function prepareReceiptPayment(receipt: ReceiptRecord) {
    const targetAccount = settingsAccount?.smartAccounts.find(
      (account) => account.id === receipt.smartAccountId,
    );
    if (!targetAccount) {
      setError("Choose a smart account for this bill before preparing payment.");
      return;
    }
    setReceiptForPayment(receipt);
    setSelectedSmartAccountId(targetAccount.id);
    setPaymentAmountSol(
      receipt.currency?.toUpperCase() === "SOL" && receipt.amount != null
        ? String(receipt.amount)
        : "",
    );
    setPaymentMemo(`${receipt.vendor || receipt.fileName || "Bill"} payment`);
    setRecipient(receipt.paymentRecipient ?? "");
    setShowPaymentModal(true);
  }

  async function approveTransaction(transactionRecord: TransactionRecord) {
    if (!signTransaction) return;
    try {
      setActing(`approve-${transactionRecord.id}`);
      setError("");
      const build = await apiRequest<BuildSignedTransactionResponse>(
        `/transactions/${transactionRecord.id}/approve-transaction?walletAddress=${walletAddress}`,
      );
      const approvalTx = Transaction.from(base64ToBytes(build.transactionBase64));
      const signedApprovalTx = await signTransaction(approvalTx);
      const sentApproval = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedApprovalTx.serialize()) }),
      });
      await apiRequest<WalletSubmittedResponse>(
        `/transactions/${transactionRecord.id}/approval-submitted`,
        {
          method: "POST",
          body: JSON.stringify({ walletAddress, txSig: sentApproval.txSig }),
        },
      );
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActing("");
    }
  }

  async function rejectTransaction(transactionRecord: TransactionRecord) {
    if (!signTransaction) return;
    try {
      setActing(`reject-${transactionRecord.id}`);
      setError("");
      const build = await apiRequest<BuildSignedTransactionResponse>(
        `/transactions/${transactionRecord.id}/reject-transaction?walletAddress=${walletAddress}`,
      );
      const rejectionTx = Transaction.from(base64ToBytes(build.transactionBase64));
      const signedRejectionTx = await signTransaction(rejectionTx);
      const sentRejection = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedRejectionTx.serialize()) }),
      });
      await apiRequest<WalletSubmittedResponse>(
        `/transactions/${transactionRecord.id}/rejection-submitted`,
        {
          method: "POST",
          body: JSON.stringify({ walletAddress, txSig: sentRejection.txSig }),
        },
      );
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActing("");
    }
  }

  async function executeTransaction(transactionRecord: TransactionRecord) {
    if (!signTransaction) return;
    try {
      setActing(`execute-${transactionRecord.id}`);
      setError("");
      const build = await apiRequest<BuildSignedTransactionResponse>(
        `/transactions/${transactionRecord.id}/execute-transaction?walletAddress=${walletAddress}`,
      );
      const executeTx = Transaction.from(base64ToBytes(build.transactionBase64));
      const signedExecuteTx = await signTransaction(executeTx);
      const sentExecute = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedExecuteTx.serialize()) }),
      });
      await apiRequest<WalletSubmittedResponse>(
        `/transactions/${transactionRecord.id}/execute-submitted`,
        {
          method: "POST",
          body: JSON.stringify({ walletAddress, txSig: sentExecute.txSig }),
        },
      );
      await loadDashboard(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setActing("");
    }
  }

  if (!connected || !walletAddress) {
    return (
      <main
        className={`${grotesk.className} flex min-h-dvh items-center justify-center bg-white px-6 text-neutral-950`}
      >
        <div className="w-full max-w-95 rounded-2xl border border-neutral-200 p-8 text-center">
          <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl bg-neutral-950 text-white">
            <Shield size={20} strokeWidth={2.25} />
          </div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Connect your wallet</h1>
          <p className="mt-2.5 text-[14px] leading-5 text-neutral-500">
            Go back to the landing page and connect Phantom to open your dashboard.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-950 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  if (!loading && dashboard && !settingsAccount) {
    return (
      <main
        className={`${grotesk.className} flex min-h-dvh items-center justify-center bg-white px-6 text-neutral-950`}
      >
        <div className="w-full max-w-95 rounded-2xl border border-neutral-200 p-8 text-center">
          <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl bg-neutral-950 text-white">
            <Building2 size={20} strokeWidth={2.25} />
          </div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Finish onboarding</h1>
          <p className="mt-2.5 text-[14px] leading-5 text-neutral-500">
            This wallet has no indexed settings account yet. Create one to open the treasury
            dashboard.
          </p>
          <Link
            href="/onboard"
            className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-950 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Start setup
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={`${grotesk.className} min-h-dvh bg-white text-neutral-950`}>
      <aside className="fixed inset-y-0 left-0 hidden w-65 flex-col border-r border-neutral-100 bg-[#FAFAF9] px-3 py-4 lg:flex">
        <button
          type="button"
          className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-950 text-[13px] font-semibold text-white">
            H
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-neutral-900">
              {settingsAccount?.name ?? "My Hover"}
            </p>
            <p className="truncate text-[13px] font-semibold leading-tight text-neutral-500">
              {formatSol(treasuryBalance)}
            </p>
          </div>
          <ChevronsUpDown size={14} className="shrink-0 text-neutral-400" />
        </button>

        <nav className="mt-4 space-y-0.5">
          <SidebarItem
            icon={<LayoutDashboard size={17} />}
            label="Dashboard"
            active={activeSection === "dashboard"}
            onClick={() => setActiveSection("dashboard")}
          />
          <SidebarItem
            icon={<Building2 size={17} />}
            label="Smart Accounts"
            active={activeSection === "accounts"}
            onClick={() => {
              setSelectedSmartAccountId("");
              setSelectedSmartAccountTab("overview");
              setActiveSection("accounts");
            }}
          />
          <SidebarItem
            icon={<RefreshCw size={17} />}
            label="Transactions"
            active={activeSection === "transactions"}
            onClick={() => setActiveSection("transactions")}
          />
          <SidebarItem
            icon={<FileText size={17} />}
            label="Invoices"
            active={activeSection === "invoices"}
            onClick={() => setActiveSection("invoices")}
          />
          <SidebarItem
            icon={<HandCoins size={17} />}
            label="Payouts"
            active={activeSection === "payouts"}
            onClick={() => setActiveSection("payouts")}
          />
          <SidebarItem
            icon={<Settings size={17} />}
            label="Settings"
            active={activeSection === "settings"}
            onClick={() => setActiveSection("settings")}
          />
        </nav>

        <div className="mt-5 border-t border-neutral-100 pt-4">
          <p className="mb-2 px-2 text-[12px] font-medium text-neutral-400">Accounts</p>
          {settingsAccount?.smartAccounts?.length ? (
            <div className="space-y-0.5">
              {settingsAccount.smartAccounts.map((account) => (
                <div key={account.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSmartAccountId(account.id);
                      setSelectedSmartAccountTab("overview");
                      setActiveSection("accounts");
                    }}
                    className={`w-full rounded-lg px-2 py-2 text-left transition-colors ${
                      selectedSmartAccountId === account.id
                        ? "bg-white text-neutral-950"
                        : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-medium">{account.name}</span>
                      <span className="shrink-0 text-[12px] font-semibold">
                        {formatSol(account.balanceLamports)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11.5px] text-neutral-400">
                      {shortAddress(account.pda)}
                    </span>
                  </button>
                  {selectedSmartAccountId === account.id && activeSection === "accounts" && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-2">
                      <SmartAccountSubnav
                        label="Overview"
                        active={selectedSmartAccountTab === "overview"}
                        onClick={() => setSelectedSmartAccountTab("overview")}
                      />
                      <SmartAccountSubnav
                        label="Review"
                        active={selectedSmartAccountTab === "review"}
                        onClick={() => setSelectedSmartAccountTab("review")}
                      />
                      <SmartAccountSubnav
                        label="Receipts"
                        active={selectedSmartAccountTab === "receipts"}
                        onClick={() => setSelectedSmartAccountTab("receipts")}
                      />
                      <SmartAccountSubnav
                        label="Transactions"
                        active={selectedSmartAccountTab === "transactions"}
                        onClick={() => setSelectedSmartAccountTab("transactions")}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-2 text-[13px] text-neutral-400">No vaults yet</p>
          )}
        </div>

        <div className="mt-auto border-t border-neutral-100 pt-4">
          <nav className="space-y-0.5">
            <SidebarItem icon={<Shield size={17} />} label="Authority" />
          </nav>
        </div>
      </aside>

      <section className="lg:pl-65">
        <header className="flex items-center justify-between px-8 py-6 lg:px-14">
          <h1 className="text-[34px] font-bold tracking-[-0.03em]">
            {activeSection === "dashboard" && "Dashboard"}
            {activeSection === "accounts" &&
              (selectedSmartAccount ? selectedSmartAccount.name : "Smart Accounts")}
            {activeSection === "transactions" && "Transactions"}
            {activeSection === "invoices" && "Invoices"}
            {activeSection === "payouts" && "Payouts"}
            {activeSection === "settings" && "Settings"}
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadDashboard(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-neutral-200 px-4 text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <RefreshCw className={loading ? "animate-spin" : ""} size={14} />
              Refresh
            </button>
            <DashboardWalletButton
              walletAddress={walletAddress}
              displayName={walletDisplayName}
              subtitle={walletSubtitle}
              onDisconnect={disconnect}
            />
          </div>
        </header>

        <nav className="mx-8 mb-2 flex gap-1 overflow-x-auto border-b border-neutral-100 pb-2 lg:hidden">
          {(
            [
              ["dashboard", "Dashboard"],
              ["accounts", "Accounts"],
              ["transactions", "Transactions"],
              ["invoices", "Invoices"],
              ["payouts", "Payouts"],
              ["settings", "Settings"],
            ] as const
          ).map(([section, label]) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              className={`h-10 shrink-0 rounded-lg px-3 text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-neutral-950 ${
                activeSection === section
                  ? "bg-neutral-950 text-white"
                  : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="px-8 pb-72 lg:px-14 lg:pb-80">
          {loading && !settingsAccount ? (
            <div className="flex h-96 items-center justify-center gap-2.5 text-[14px] text-neutral-500">
              <Loader2 className="animate-spin" size={17} />
              Loading dashboard
            </div>
          ) : (
            <>
              <div className="grid gap-px overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Treasury balance" value={formatSol(treasuryBalance)} />
                <Metric
                  label="Settings PDA"
                  value={shortAddress(settingsAccount?.pda ?? "")}
                  mono
                />
                <Metric
                  label="Threshold"
                  value={`${settingsAccount?.threshold ?? 0} of ${settingsAccount?.signers?.length ?? 0}`}
                />
                <Metric
                  label="Transactions"
                  value={String(settingsAccount?.transactions?.length ?? 0)}
                />
              </div>

              {activeSection === "dashboard" && (
                <>
                  <section className="mt-10">
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
                          Settings account
                        </h2>
                        <p className="mt-0.5 text-[13px] text-neutral-500">
                          Authority, signer set, threshold, and transaction indexes.
                        </p>
                      </div>
                      <span className="rounded-full bg-neutral-100 px-3 py-1 font-mono text-[12px] font-medium text-neutral-600">
                        {settingsAccount?.timeLock ?? 0}s timelock
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info
                        label="Settings PDA"
                        value={settingsAccount?.pda ?? ""}
                        copied={copied}
                        onCopy={copy}
                      />
                      <Info
                        label="Settings authority"
                        value={settingsAccount?.settingsAuthority ?? ""}
                        copied={copied}
                        onCopy={copy}
                      />
                      <Info
                        label="Transaction index"
                        value={String(settingsAccount?.transactionIndex ?? 0)}
                        copied={copied}
                        onCopy={copy}
                      />
                      <Info
                        label="Stale transaction index"
                        value={String(settingsAccount?.staleTransactionIndex ?? 0)}
                        copied={copied}
                        onCopy={copy}
                      />
                    </div>

                    <div className="mt-5">
                      <div className="grid grid-cols-[2fr_3fr_1.4fr] px-3 pb-2 text-[12px] font-bold text-black">
                        <span>Signer</span>
                        <span>Public key</span>
                        <span className="text-right">Permissions</span>
                      </div>
                      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
                        {settingsAccount?.signers?.map((signer) => {
                          const color = avatarColor(signer.walletAddress);
                          const displayName =
                            signer.name ?? signer.label ?? signer.role.toLowerCase();
                          return (
                            <div
                              key={signer.id}
                              className="grid grid-cols-[2fr_3fr_1.4fr] items-center px-3 py-3 transition-colors hover:bg-neutral-50"
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                                  style={{ backgroundColor: color.bg, color: color.fg }}
                                >
                                  {initials(displayName)}
                                </div>
                                <span className="truncate text-[13px] font-medium text-neutral-800">
                                  {displayName}
                                </span>
                              </div>
                              <span className="truncate font-mono text-[12.5px] text-neutral-500">
                                {signer.walletAddress}
                              </span>
                              <PermissionChips mask={signer.permissionsMask} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <section className="mt-10">
                    <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
                      Recent activity
                    </h2>
                    <p className="mt-0.5 text-[13px] text-neutral-500">Latest.</p>

                    <ActivityList activities={settingsAccount?.activities ?? []} />
                  </section>
                </>
              )}

              {activeSection === "accounts" && (
                <section className="mt-10">
                  {selectedSmartAccount ? (
                    <SelectedSmartAccountView
                      account={selectedSmartAccount}
                      transactions={selectedSmartAccountTransactions}
                      receipts={
                        selectedSmartAccountTab === "receipts"
                          ? selectedSmartAccountReceipts
                          : selectedSmartAccountReviewReceipts
                      }
                      selectedTab={selectedSmartAccountTab}
                      threshold={settingsAccount?.threshold ?? 0}
                      currentSigner={currentSigner}
                      copied={copied}
                      walletAddress={walletAddress}
                      onBack={() => setSelectedSmartAccountId("")}
                      onCopy={copy}
                      onOpenReceipt={setReceiptPreview}
                      onDeleteReceipt={(receipt) => void deleteReceipt(receipt)}
                      onPrepareReceiptPayment={prepareReceiptPayment}
                      acting={acting}
                      onApprove={approveTransaction}
                      onReject={rejectTransaction}
                      onExecute={executeTransaction}
                      onTabChange={setSelectedSmartAccountTab}
                    />
                  ) : (
                    <Panel
                      title="Smart accounts"
                      description="Create Smart Accounts."
                      action={
                        <button
                          type="button"
                          onClick={() => void createSmartAccount()}
                          disabled={acting === "smart-account" || !smartAccountName.trim()}
                          className="flex h-9 items-center gap-2 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {acting === "smart-account" ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                          Create
                        </button>
                      }
                    >
                      <div className="grid gap-3 text-lg text-black sm:grid-cols-[1fr_160px]">
                        <TextField
                          label="Account name"
                          value={smartAccountName}
                          onChange={setSmartAccountName}
                          placeholder="Payroll vault"
                        />
                        <ReadOnlyField
                          label="Next index"
                          value={`#${nextSmartAccountIndex}`}
                          // helper="Auto-derived"
                        />
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {settingsAccount?.smartAccounts?.length ? (
                          settingsAccount.smartAccounts.map((account) => (
                            <SmartAccountCard
                              key={account.id}
                              account={account}
                              selected={false}
                              copied={copied}
                              onSelect={() => setSelectedSmartAccountId(account.id)}
                              onCopy={copy}
                            />
                          ))
                        ) : (
                          <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-[13px] text-neutral-400 sm:col-span-2">
                            No smart accounts yet.
                          </div>
                        )}
                      </div>
                    </Panel>
                  )}
                </section>
              )}

              {activeSection === "transactions" && (
                <section className="mt-10 space-y-5">
                  <Panel
                    title="Payout proposals"
                    description="Review recipient, batch context, votes, and settlement state before funds move."
                  >
                    <TransactionList
                      transactions={payoutTransactions}
                      threshold={settingsAccount?.threshold ?? 0}
                      walletAddress={walletAddress}
                      currentSigner={currentSigner}
                      acting={acting}
                      onApprove={approveTransaction}
                      onReject={rejectTransaction}
                      onExecute={executeTransaction}
                    />
                  </Panel>

                  <Panel
                    title="Other transactions"
                    description="Bills, receipts, and direct transfers that are not part of a payout batch."
                    action={
                      <button
                        type="button"
                        onClick={() => setShowPaymentModal(true)}
                        disabled={!paymentSmartAccount}
                        className="flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-semibold bg-white text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send size={14} />
                        Create
                      </button>
                    }
                  >
                    <TransactionList
                      transactions={otherTransactions}
                      threshold={settingsAccount?.threshold ?? 0}
                      walletAddress={walletAddress}
                      currentSigner={currentSigner}
                      acting={acting}
                      onApprove={approveTransaction}
                      onReject={rejectTransaction}
                      onExecute={executeTransaction}
                    />
                  </Panel>
                </section>
              )}

              {activeSection === "invoices" && settingsAccount && (
                <InvoiceWorkspace
                  settingsAccount={settingsAccount}
                  walletAddress={walletAddress}
                  onError={setError}
                />
              )}

              {activeSection === "payouts" && settingsAccount && (
                <PayoutWorkspace
                  settingsAccount={settingsAccount}
                  walletAddress={walletAddress}
                  onError={setError}
                />
              )}

              {activeSection === "settings" && (
                <section className="mt-10">
                  <div className="grid gap-5 xl:grid-cols-3">
                    <Panel
                      title="Threshold"
                      description="number of signer approvals"
                      action={
                        <button
                          type="button"
                          onClick={() => void changeThreshold()}
                          disabled={
                            acting === "threshold" ||
                            !newThreshold ||
                            Number(newThreshold) === settingsAccount?.threshold
                          }
                          className="flex h-9 items-center gap-2 rounded-full bg-neutral-950 px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {acting === "threshold" ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Edit3 size={14} />
                          )}
                          Update
                        </button>
                      }
                    >
                      <TextField
                        label={`Current: ${settingsAccount?.threshold ?? 0} of ${settingsAccount?.signers?.length ?? 0}`}
                        value={newThreshold}
                        onChange={setNewThreshold}
                        placeholder="2"
                        type="number"
                      />
                    </Panel>

                    <ActionCard
                      title="Invite signer"
                      description="Add a teammate, collect their wallet, and submit the signer change through Phantom."
                      icon={<UserPlus size={18} />}
                      actionLabel="Add signer"
                      onAction={() => {
                        setLatestInviteUrl("");
                        setSignerStep(0);
                        setShowSignerModal(true);
                      }}
                    />

                    <Panel
                      title="Timelock"
                      description="Timelock update "
                      action={
                        <button
                          type="button"
                          disabled
                          className="flex h-9 cursor-not-allowed items-center gap-2 rounded-full bg-neutral-100 px-4 text-[13px] font-semibold text-neutral-400"
                        >
                          <Clock size={14} />
                          Soon
                        </button>
                      }
                    >
                      <TextField
                        label={`Current: ${settingsAccount?.timeLock ?? 0}s`}
                        value={String(settingsAccount?.timeLock ?? 0)}
                        onChange={() => undefined}
                        placeholder="0"
                        type="number"
                      />
                    </Panel>
                  </div>

                  <div className="mt-5">
                    <div className="grid grid-cols-[2fr_3fr_1fr] px-3 pb-2 text-[12px] font-medium text-neutral-400">
                      <span>Signer</span>
                      <span>Public key</span>
                      <span className="text-right">Permissions</span>
                    </div>
                    <SignerList signers={settingsAccount?.signers ?? []} />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </section>
      {error && <DashboardToast message={error} onClose={() => setError("")} />}
      {showSignerModal && (
        <AddSignerModal
          acting={acting}
          step={signerStep}
          settingsAccount={settingsAccount}
          signerName={signerName}
          signerDesignation={signerDesignation}
          signerEmail={signerEmail}
          signerAddress={signerAddress}
          signerPermissions={signerPermissions}
          inviteUrl={latestInviteUrl}
          copied={copied}
          onStepChange={setSignerStep}
          onNameChange={setSignerName}
          onDesignationChange={setSignerDesignation}
          onEmailChange={setSignerEmail}
          onAddressChange={setSignerAddress}
          onPermissionsChange={setSignerPermissions}
          onClose={() => {
            setSignerStep(0);
            setLatestInviteUrl("");
            setSignerAddress("");
            setSignerName("");
            setSignerEmail("");
            setSignerDesignation("");
            setSignerPermissions("7");
            setShowSignerModal(false);
          }}
          onCopy={copy}
          onSubmit={() => void addSigner()}
        />
      )}
      {showPaymentModal && (
        <CreateTransactionModal
          acting={acting}
          smartAccounts={settingsAccount?.smartAccounts ?? []}
          selectedSmartAccountId={paymentSmartAccount?.id ?? ""}
          amountSol={paymentAmountSol}
          recipient={recipient}
          memo={paymentMemo}
          onSmartAccountChange={setSelectedSmartAccountId}
          onAmountChange={setPaymentAmountSol}
          onRecipientChange={setRecipient}
          onMemoChange={setPaymentMemo}
          onClose={() => {
            setReceiptForPayment(null);
            setShowPaymentModal(false);
          }}
          onSubmit={() => void createPayment()}
        />
      )}
      {receiptPreview && (
        <ReceiptPreviewModal
          receipt={receiptPreview}
          walletAddress={walletAddress}
          onClose={() => setReceiptPreview(null)}
        />
      )}
      {settingsAccount && !showSignerModal && !showPaymentModal && (
        <FloatingDashboardChat
          settingsAccount={settingsAccount}
          walletAddress={walletAddress}
          signTransaction={signTransaction}
          onRefresh={() => loadDashboard(true)}
          onError={setError}
        />
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  mono = false,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="bg-black text-white p-5">
      <p className="text-[12.5px]  text-white">{label}</p>
      <p
        className={`mt-5 truncate text-white font-semibold tracking-[-0.03em] ${
          mono ? "font-mono tracking-tight" : ""
        }`}
      >
        {value}
      </p>
      {action}
    </div>
  );
}

function ActionCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <section className="rounded-2xl border border-neutral-100 bg-black p-5 text-white">
      <div className="flex min-h-40 flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-white/70">{description}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white">
            {icon}
          </div>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="flex h-10 w-fit items-center gap-2 rounded-full bg-white px-4 text-[13px] font-semibold text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Plus size={14} />
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

function DashboardWalletButton({
  walletAddress,
  displayName,
  subtitle,
  onDisconnect,
}: {
  walletAddress: string;
  displayName: string;
  subtitle?: string;
  onDisconnect: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!walletAddress) return null;

  const safeDisplayName = displayName || "Wallet";
  const shortWalletAddress = shortAddress(walletAddress);

  async function copyAddress() {
    await navigator.clipboard.writeText(walletAddress);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 900);
  }

  async function disconnectWallet() {
    setOpen(false);
    await onDisconnect();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full bg-black py-1 pl-1.5 pr-3 text-white shadow-sm transition-colors hover:bg-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black">
          {initials(safeDisplayName)}
        </span>
        <span className="hidden max-w-30 truncate text-[13px] font-medium tracking-[-0.01em] sm:block">
          {safeDisplayName}
        </span>
        <ChevronDown
          size={15}
          strokeWidth={1.8}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-[20px] border border-neutral-200 bg-white p-1.5 text-neutral-950 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
          <div className="px-3.5 py-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-black text-[12px] font-semibold text-white">
                {initials(safeDisplayName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">{safeDisplayName}</p>
                <p className="truncate text-[12px] text-neutral-500">
                  {subtitle || shortWalletAddress}
                </p>
              </div>
            </div>
            <p className="mt-3 truncate rounded-xl bg-neutral-50 px-3 py-2 font-mono text-[11.5px] text-neutral-500">
              {walletAddress}
            </p>
          </div>

          <div className="border-t border-neutral-100 pt-1">
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
            >
              {copiedAddress ? <Check size={16} /> : <Copy size={16} />}
              {copiedAddress ? "Copied address" : "Copy address"}
            </button>
            <button
              type="button"
              onClick={() => void disconnectWallet()}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3.5 text-left text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            >
              <LogOut size={16} />
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-medium text-neutral-500">{label}</span>
      <div className="flex h-10 items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3">
        <span className="font-mono text-[13px] text-neutral-900">{value}</span>
        {helper && <span className="text-[12px] font-medium text-neutral-400">{helper}</span>}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <div className="rounded-xl bg-black text-white border border-neutral-100 p-4">
      <p className="text-[12.5px] text-white">{label}</p>
      <div className="mt-3 flex items-center gap-2.5">
        <p className="truncate font-mono text-[13px] text-white">{value || "-"}</p>
        {value && (
          <button
            type="button"
            onClick={() => void onCopy(value)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label={`Copy ${label}`}
          >
            {copied === value ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
