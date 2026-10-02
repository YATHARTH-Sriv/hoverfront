"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Transaction } from "@solana/web3.js";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import {
  AgentField,
  AgentResponse,
  BuildSignedTransactionResponse,
  ChatInputProps,
  DraftFields,
  ReceiptRecord,
  ReceiptStep,
  SendTransactionResponse,
  SmartAccount,
  StepState,
  TransactionRecord,
} from "./chatinputtypes";
import { API_BASE } from "@/constant";

const searchOptions = [
  { name: "Settings", locked: false },
  { name: "Smart Account", locked: false },
  { name: "Transactions", locked: false },
  { name: "Policies", locked: false },
];

const initialDraft: DraftFields = {
  signer: "",
  name: "",
  email: "",
  designation: "",
  permissionsMask: "7",
  newThreshold: "",
  smartAccountName: "",
  smartAccountId: "",
  amountSol: "",
  recipient: "",
  memo: "",
  period: "MONTH",
  transactionRecordId: "",
};

const initialReceiptDraft = {
  smartAccountId: "",
  vendor: "",
  amount: "",
  currency: "",
  dueDate: "",
  invoiceNumber: "",
  category: "",
  recipient: "",
  amountSol: "",
  memo: "",
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

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function shortAddress(address?: string | null) {
  if (!address) return "-";
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function permissionActions(mask?: number) {
  const value = mask ?? 0;
  const actions: string[] = [];
  if ((value & 1) !== 0) actions.push("Initiate payments");
  if ((value & 2) !== 0) actions.push("Approve payments");
  if ((value & 4) !== 0) actions.push("Execute payments");
  return actions.length ? actions : ["No payment actions"];
}

function permissionText(mask?: number) {
  return permissionActions(mask).join(", ");
}

function PermissionChips({ mask }: { mask?: number }) {
  return (
    <div className="flex max-w-65 flex-wrap justify-end gap-1.5">
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

function lamportsToSol(value?: string | number | null) {
  const lamports = Number(value ?? 0);
  if (!Number.isFinite(lamports)) return "0.00 SOL";
  return `${(lamports / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} SOL`;
}

function displayLabel(label: string) {
  const labels: Record<string, string> = {
    settingsPda: "Settings account",
    authority: "Settings authority",
    threshold: "Approval threshold",
    timeLock: "Timelock",
    connectedWalletIsAuthority: "Your wallet controls settings",
    connectedWalletIsSigner: "Your wallet is signer",
  };
  if (labels[label]) return labels[label];

  return label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function displayValue(label: string, value: string) {
  const lower = label.toLowerCase();
  if ((lower.includes("pda") || lower.includes("authority")) && value.length > 18) {
    return shortAddress(value);
  }
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  return value;
}

function summaryEntries(summary?: Record<string, string | number | boolean | null>) {
  if (!summary) return [];
  const preferred = [
    "settingsPda",
    "authority",
    "threshold",
    "timeLock",
    "connectedWalletIsAuthority",
  ];
  return preferred.filter((key) => key in summary).map((key) => [key, summary[key]] as const);
}

function statusCopy(status: StepState) {
  if (status === "thinking") return "Thinking through the settings request";
  if (status === "needs_fields") return "Need a few details";
  if (status === "preview") return "Ready for confirmation";
  if (status === "preparing") return "Preparing wallet transaction";
  if (status === "wallet") return "Waiting for Phantom";
  if (status === "submitting") return "Submitting and indexing";
  if (status === "implemented") return "Implemented";
  if (status === "error") return "Needs attention";
  return "Ready";
}

function receiptStatusCopy(status: ReceiptStep) {
  if (status === "uploading") return "Scanning receipt";
  if (status === "review") return "Ready for review";
  if (status === "preparing") return "Preparing payment";
  if (status === "wallet") return "Waiting for Phantom";
  if (status === "submitting") return "Submitting and indexing";
  if (status === "implemented") return "Payment prepared";
  if (status === "error") return "Needs attention";
  return "Ready";
}

function ChatInput({
  settingsAccount,
  walletAddress = "",
  signTransaction,
  onRefresh,
  onError,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState("Settings");
  const [message, setMessage] = useState("");
  const [agentResponse, setAgentResponse] = useState<AgentResponse | null>(null);
  const [draft, setDraft] = useState<DraftFields>(initialDraft);
  const [receipt, setReceipt] = useState<ReceiptRecord | null>(null);
  const [receiptDraft, setReceiptDraft] = useState(initialReceiptDraft);
  const [receiptStep, setReceiptStep] = useState<ReceiptStep>("idle");
  const [receiptError, setReceiptError] = useState("");
  const [step, setStep] = useState<StepState>("idle");
  const [error, setError] = useState("");
  const [lastTx, setLastTx] = useState("");

  const canExecute = Boolean(settingsAccount && walletAddress && signTransaction);
  const currentAction = agentResponse?.action;
  const isBusy = ["thinking", "preparing", "wallet", "submitting"].includes(step);
  const signerDraftComplete = Boolean(
    draft.signer.trim() &&
    draft.name.trim() &&
    draft.email.trim() &&
    draft.designation.trim() &&
    Number(draft.permissionsMask) > 0,
  );

  const hydratedPreview = useMemo(() => {
    if (!agentResponse?.preview) return null;
    const draftAmountSol = Number(draft.amountSol);
    const amountSol =
      draft.amountSol && Number.isFinite(draftAmountSol)
        ? draftAmountSol
        : (agentResponse.preview.amountSol ?? null);
    const currentSignerCount =
      settingsAccount?.signers.length ?? agentResponse.preview.currentSignerCount ?? 0;
    const signerWallet = draft.signer || agentResponse.preview.signer || "";
    const signerAlreadyExists =
      settingsAccount?.signers.some((signer) => signer.walletAddress === signerWallet.trim()) ??
      false;
    const expectedSignerCount =
      currentAction === "add_signer"
        ? signerWallet && !signerAlreadyExists
          ? currentSignerCount + 1
          : currentSignerCount
        : currentAction === "remove_signer"
          ? signerWallet && signerAlreadyExists
            ? currentSignerCount - 1
            : currentSignerCount
          : (agentResponse.preview.expectedSignerCount ?? currentSignerCount);
    return {
      ...agentResponse.preview,
      signer: signerWallet || null,
      permissionsMask: Number(draft.permissionsMask || agentResponse.preview.permissionsMask || 7),
      requestedThreshold: draft.newThreshold
        ? Number(draft.newThreshold)
        : (agentResponse.preview.requestedThreshold ?? null),
      currentSignerCount,
      expectedSignerCount,
      smartAccountName: draft.smartAccountName || agentResponse.preview.smartAccountName || null,
      smartAccountId: draft.smartAccountId || agentResponse.preview.smartAccountId || null,
      amountSol,
      amountLamports:
        amountSol !== null
          ? String(Math.round(amountSol * 1_000_000_000))
          : (agentResponse.preview.amountLamports ?? null),
      recipient: draft.recipient || agentResponse.preview.recipient || null,
      memo: draft.memo || agentResponse.preview.memo || null,
      transactionRecordId:
        draft.transactionRecordId || agentResponse.preview.transactionRecordId || null,
      period: draft.period || agentResponse.preview.period || "MONTH",
    };
  }, [agentResponse, draft, settingsAccount]);

  function updateDraft(name: keyof DraftFields, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function showError(messageText: string) {
    setError(messageText);
    setStep("error");
    onError?.(messageText);
  }

  function showReceiptError(messageText: string) {
    setReceiptError(messageText);
    setReceiptStep("error");
    onError?.(messageText);
  }

  async function handleReceiptUpload(file: File) {
    if (!settingsAccount || !walletAddress) {
      showReceiptError("Connect a wallet and open a settings account first.");
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      showReceiptError("Upload an image or PDF receipt.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showReceiptError("Receipt file must be 20MB or smaller.");
      return;
    }

    try {
      setAgentResponse(null);
      setReceipt(null);
      setReceiptError("");
      setReceiptStep("uploading");

      const response = await fetch(
        `${API_BASE}/receipts/scan?walletAddress=${encodeURIComponent(walletAddress)}&settingsPda=${encodeURIComponent(settingsAccount.pda)}`,
        {
          method: "POST",
          headers: {
            "content-type": file.type || "application/octet-stream",
            "x-file-name": file.name,
          },
          body: file,
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(typeof payload.error === "string" ? payload.error : "Receipt scan failed");

      const scannedReceipt = payload.receipt as ReceiptRecord;
      const defaultSmartAccount = settingsAccount.smartAccounts?.[0];
      setReceipt(scannedReceipt);
      setReceiptDraft({
        smartAccountId: scannedReceipt.smartAccountId ?? defaultSmartAccount?.id ?? "",
        vendor: scannedReceipt.vendor ?? "",
        amount: scannedReceipt.amount == null ? "" : String(scannedReceipt.amount),
        currency: scannedReceipt.currency ?? "",
        dueDate: scannedReceipt.dueDate ? String(scannedReceipt.dueDate).slice(0, 10) : "",
        invoiceNumber: scannedReceipt.invoiceNumber ?? "",
        category: scannedReceipt.category ?? "",
        recipient: scannedReceipt.paymentRecipient ?? "",
        amountSol: "",
        memo: `${scannedReceipt.vendor ?? "Receipt"} payment`,
      });
      setReceiptStep("review");
      await onRefresh?.();
    } catch (err) {
      showReceiptError(err instanceof Error ? err.message : "Receipt scan failed");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateReceiptDraft(name: keyof typeof initialReceiptDraft, value: string) {
    setReceiptDraft((current) => ({ ...current, [name]: value }));
  }

  async function prepareReceiptPayment() {
    if (!settingsAccount || !walletAddress || !signTransaction || !receipt) {
      showReceiptError("Connect a wallet that can sign transactions first.");
      return;
    }
    const selectedSmartAccount = settingsAccount.smartAccounts?.find(
      (account) => account.id === receiptDraft.smartAccountId,
    );
    if (!selectedSmartAccount) {
      showReceiptError("Choose the smart account that should pay this bill.");
      return;
    }
    const amountSol = Number(receiptDraft.amountSol);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      showReceiptError("Enter the SOL amount to prepare.");
      return;
    }
    if (!receiptDraft.recipient.trim()) {
      showReceiptError("Recipient wallet is required.");
      return;
    }

    try {
      setReceiptError("");
      setReceiptStep("preparing");
      await apiRequest(`/receipts/${receipt.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          walletAddress,
          smartAccountId: selectedSmartAccount.id,
          vendor: receiptDraft.vendor,
          amount: receiptDraft.amount,
          currency: receiptDraft.currency,
          dueDate: receiptDraft.dueDate,
          invoiceNumber: receiptDraft.invoiceNumber,
          category: receiptDraft.category,
          paymentRecipient: receiptDraft.recipient,
        }),
      });

      const amountLamports = String(Math.round(amountSol * 1_000_000_000));
      const memo = receiptDraft.memo || `${receiptDraft.vendor || "Receipt"} payment`;
      const createBuild = await apiRequest<BuildSignedTransactionResponse>(
        "/transactions/build-create",
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            accountIndex: selectedSmartAccount.accountIndex,
            recipient: receiptDraft.recipient,
            amountLamports,
            memo,
            smartAccountName: selectedSmartAccount.name,
          }),
        },
      );

      setReceiptStep("wallet");
      const createTx = Transaction.from(base64ToBytes(createBuild.transactionBase64));
      const signedCreateTx = await signTransaction(createTx);

      setReceiptStep("submitting");
      const sentCreate = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedCreateTx.serialize()) }),
      });

      setReceiptStep("wallet");
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

      setReceiptStep("submitting");
      const sentProposal = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signedProposalTx.serialize()) }),
      });

      await apiRequest("/transactions/wallet-submitted", {
        method: "POST",
        body: JSON.stringify({
          walletAddress,
          settingsPda: settingsAccount.pda,
          recipient: receiptDraft.recipient,
          accountIndex: selectedSmartAccount.accountIndex,
          transactionIndex: createBuild.transactionIndex,
          transactionPda: createBuild.transactionPda,
          proposalPda: proposalBuild.proposalPda,
          smartAccountPda: createBuild.smartAccountPda,
          amountLamports,
          memo,
          smartAccountName: selectedSmartAccount.name,
          createTxSig: sentCreate.txSig,
          proposalTxSig: sentProposal.txSig,
          receiptId: receipt.id,
        }),
      });

      setLastTx(sentProposal.txSig);
      setReceiptStep("implemented");
      await onRefresh?.();
    } catch (err) {
      showReceiptError(err instanceof Error ? err.message : "Receipt payment failed");
    }
  }

  async function handleSubmit() {
    if (!message.trim() || isBusy) return;

    setStep("thinking");
    setError("");
    setLastTx("");

    try {
      const response = await apiRequest<AgentResponse>("/agent/settings/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          mode: searchMode,
          walletAddress,
          settingsPda: settingsAccount?.pda,
        }),
      });

      setAgentResponse(response);
      setMessage("");

      if (response.kind === "needs_fields") {
        setDraft((current) => ({
          ...current,
          signer: response.preview?.signer ?? current.signer,
          name: response.preview?.name ?? current.name,
          email: response.preview?.email ?? current.email,
          designation: response.preview?.designation ?? current.designation,
          permissionsMask: String(response.preview?.permissionsMask ?? current.permissionsMask),
          smartAccountId: response.preview?.smartAccountId ?? current.smartAccountId,
          smartAccountName: response.preview?.smartAccountName ?? current.smartAccountName,
          amountSol: response.preview?.amountSol
            ? String(response.preview.amountSol)
            : current.amountSol,
          recipient: response.preview?.recipient ?? current.recipient,
          memo: response.preview?.memo ?? current.memo,
          transactionRecordId: response.preview?.transactionRecordId ?? current.transactionRecordId,
          period: response.preview?.period ?? current.period,
          newThreshold: response.preview?.requestedThreshold
            ? String(response.preview.requestedThreshold)
            : current.newThreshold,
        }));
        setStep("needs_fields");
      } else if (response.kind === "preview") {
        setDraft((current) => ({
          ...current,
          signer: response.preview?.signer ?? current.signer,
          name: response.preview?.name ?? current.name,
          email: response.preview?.email ?? current.email,
          designation: response.preview?.designation ?? current.designation,
          permissionsMask: String(response.preview?.permissionsMask ?? current.permissionsMask),
          smartAccountId: response.preview?.smartAccountId ?? current.smartAccountId,
          smartAccountName: response.preview?.smartAccountName ?? current.smartAccountName,
          amountSol: response.preview?.amountSol
            ? String(response.preview.amountSol)
            : current.amountSol,
          recipient: response.preview?.recipient ?? current.recipient,
          memo: response.preview?.memo ?? current.memo,
          transactionRecordId: response.preview?.transactionRecordId ?? current.transactionRecordId,
          period: response.preview?.period ?? current.period,
          newThreshold: response.preview?.requestedThreshold
            ? String(response.preview.requestedThreshold)
            : current.newThreshold,
        }));
        setStep(response.status === "blocked" ? "error" : "preview");
      } else {
        setStep("implemented");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Agent request failed");
    }
  }

  function openPreviewFromFields(event: FormEvent<HTMLFormElement>): boolean {
    event.preventDefault();
    if (!agentResponse) return false;
    if (
      (currentAction === "add_signer" || currentAction === "remove_signer") &&
      !draft.signer.trim()
    ) {
      showError("Signer wallet is required.");
      return false;
    }
    if (currentAction === "add_signer") {
      const permissionsMask = Number(draft.permissionsMask);
      if (!draft.name.trim() || !draft.email.trim() || !draft.designation.trim()) {
        showError("Name, email, and role are required for a new signer.");
        return false;
      }
      if (!Number.isInteger(permissionsMask) || permissionsMask < 1 || permissionsMask > 7) {
        showError("Choose at least one signer permission.");
        return false;
      }
    }
    if (currentAction === "change_threshold") {
      const threshold = Number(draft.newThreshold);
      const voteSigners =
        settingsAccount?.signers.filter((signer) => (signer.permissionsMask & 2) !== 0).length ?? 0;
      if (!Number.isInteger(threshold) || threshold < 1 || threshold > voteSigners) {
        showError(`Threshold must be between 1 and ${voteSigners}.`);
        return false;
      }
    }
    if (currentAction === "create_smart_account" && !draft.smartAccountName.trim()) {
      showError("Smart account name is required.");
      return false;
    }
    if (currentAction === "fund_smart_account") {
      const amount = Number(draft.amountSol);
      if (!draft.smartAccountId && !agentResponse.preview?.smartAccountId) {
        showError("Choose a smart account to fund.");
        return false;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        showError("Enter a positive SOL amount.");
        return false;
      }
    }
    if (currentAction === "create_transaction") {
      const amount = Number(draft.amountSol);
      if (!draft.smartAccountId && !agentResponse.preview?.smartAccountId) {
        showError("Choose the source smart account.");
        return false;
      }
      if (!draft.recipient.trim() && !agentResponse.preview?.recipient) {
        showError("Recipient wallet is required.");
        return false;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        showError("Enter a positive SOL amount.");
        return false;
      }
    }
    if (
      (currentAction === "approve_transaction" || currentAction === "execute_transaction") &&
      !draft.transactionRecordId &&
      !agentResponse.preview?.transactionRecordId
    ) {
      showError("Choose a transaction.");
      return false;
    }
    setError("");
    setStep("preview");
    return true;
  }

  async function executePreview() {
    if (!settingsAccount || !walletAddress || !signTransaction || !currentAction) {
      showError("Connect a wallet that can sign transactions first.");
      return;
    }

    try {
      setError("");
      if (currentAction === "add_signer" && !signerDraftComplete) {
        showError("Complete the signer name, email, role, and permissions before confirming.");
        return;
      }
      setStep("preparing");

      if (currentAction === "create_smart_account") {
        const nextIndex =
          hydratedPreview?.accountIndex ?? settingsAccount.smartAccounts?.length ?? 0;
        await apiRequest("/smart-accounts", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            name: hydratedPreview?.smartAccountName ?? draft.smartAccountName,
            accountIndex: nextIndex,
          }),
        });
        setStep("implemented");
        setDraft(initialDraft);
        await onRefresh?.();
        return;
      }

      if (currentAction === "create_transaction") {
        const selectedSmartAccount = settingsAccount.smartAccounts?.find(
          (account) => account.id === (hydratedPreview?.smartAccountId ?? draft.smartAccountId),
        );
        if (!selectedSmartAccount) {
          showError("Choose the source smart account.");
          return;
        }
        const amountLamports =
          hydratedPreview?.amountLamports ??
          String(Math.round(Number(draft.amountSol) * 1_000_000_000));
        const recipient = hydratedPreview?.recipient ?? draft.recipient;
        const memo = hydratedPreview?.memo ?? (draft.memo || "Agent payment");

        const createBuild = await apiRequest<BuildSignedTransactionResponse>(
          "/transactions/build-create",
          {
            method: "POST",
            body: JSON.stringify({
              walletAddress,
              settingsPda: settingsAccount.pda,
              accountIndex: selectedSmartAccount.accountIndex,
              recipient,
              amountLamports,
              memo,
              smartAccountName: selectedSmartAccount.name,
            }),
          },
        );

        setStep("wallet");
        const createTx = Transaction.from(base64ToBytes(createBuild.transactionBase64));
        const signedCreateTx = await signTransaction(createTx);

        setStep("submitting");
        const sentCreate = await apiRequest<SendTransactionResponse>("/transactions/send", {
          method: "POST",
          body: JSON.stringify({ transactionBase64: bytesToBase64(signedCreateTx.serialize()) }),
        });

        setStep("wallet");
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

        setStep("submitting");
        const sentProposal = await apiRequest<SendTransactionResponse>("/transactions/send", {
          method: "POST",
          body: JSON.stringify({ transactionBase64: bytesToBase64(signedProposalTx.serialize()) }),
        });

        await apiRequest("/transactions/wallet-submitted", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            recipient,
            accountIndex: selectedSmartAccount.accountIndex,
            transactionIndex: createBuild.transactionIndex,
            transactionPda: createBuild.transactionPda,
            proposalPda: proposalBuild.proposalPda,
            smartAccountPda: createBuild.smartAccountPda,
            amountLamports,
            memo,
            smartAccountName: selectedSmartAccount.name,
            createTxSig: sentCreate.txSig,
            proposalTxSig: sentProposal.txSig,
          }),
        });

        setLastTx(sentProposal.txSig);
        setStep("implemented");
        setDraft(initialDraft);
        await onRefresh?.();
        return;
      }

      if (currentAction === "approve_transaction" || currentAction === "execute_transaction") {
        const transactionId = hydratedPreview?.transactionRecordId ?? draft.transactionRecordId;
        if (!transactionId) {
          showError("Choose a transaction.");
          return;
        }

        const build = await apiRequest<BuildSignedTransactionResponse>(
          `/transactions/${transactionId}/${currentAction === "approve_transaction" ? "approve-transaction" : "execute-transaction"}?walletAddress=${encodeURIComponent(walletAddress)}`,
        );
        setStep("wallet");
        const tx = Transaction.from(base64ToBytes(build.transactionBase64));
        const signed = await signTransaction(tx);

        setStep("submitting");
        const sent = await apiRequest<SendTransactionResponse>("/transactions/send", {
          method: "POST",
          body: JSON.stringify({ transactionBase64: bytesToBase64(signed.serialize()) }),
        });

        await apiRequest(
          `/transactions/${transactionId}/${currentAction === "approve_transaction" ? "approval-submitted" : "execute-submitted"}`,
          {
            method: "POST",
            body: JSON.stringify({ walletAddress, txSig: sent.txSig }),
          },
        );

        setLastTx(sent.txSig);
        setStep("implemented");
        setDraft(initialDraft);
        await onRefresh?.();
        return;
      }

      const buildPath =
        currentAction === "add_signer"
          ? "/settings/add-signer/build"
          : currentAction === "remove_signer"
            ? "/settings/remove-signer/build"
            : currentAction === "change_threshold"
              ? "/settings/change-threshold/build"
              : currentAction === "fund_smart_account"
                ? "/smart-accounts/fund/build"
                : "";

      if (!buildPath) {
        showError("This settings action is not wallet-safe yet.");
        return;
      }

      const selectedSmartAccount = settingsAccount.smartAccounts?.find(
        (account) => account.id === (hydratedPreview?.smartAccountId ?? draft.smartAccountId),
      );
      if (
        currentAction === "fund_smart_account" &&
        !selectedSmartAccount &&
        !hydratedPreview?.smartAccountPda
      ) {
        showError("Choose a smart account to fund.");
        return;
      }

      const buildBody =
        currentAction === "add_signer"
          ? {
              walletAddress,
              settingsPda: settingsAccount.pda,
              signer: hydratedPreview?.signer ?? draft.signer,
              permissionsMask: hydratedPreview?.permissionsMask ?? Number(draft.permissionsMask),
              memo: `Add ${draft.name || "teammate"} as signer`,
            }
          : currentAction === "remove_signer"
            ? {
                walletAddress,
                settingsPda: settingsAccount.pda,
                signer: hydratedPreview?.signer ?? draft.signer,
                memo: `Remove ${shortAddress(hydratedPreview?.signer ?? draft.signer)} as signer`,
              }
            : currentAction === "change_threshold"
              ? {
                  walletAddress,
                  settingsPda: settingsAccount.pda,
                  newThreshold: hydratedPreview?.requestedThreshold ?? Number(draft.newThreshold),
                  memo: "Agent threshold update",
                }
              : {
                  walletAddress,
                  smartAccountPda: hydratedPreview?.smartAccountPda ?? selectedSmartAccount?.pda,
                  amountLamports:
                    hydratedPreview?.amountLamports ??
                    String(Math.round(Number(draft.amountSol) * 1_000_000_000)),
                };

      const built = await apiRequest<BuildSignedTransactionResponse>(buildPath, {
        method: "POST",
        body: JSON.stringify(buildBody),
      });

      setStep("wallet");
      const transaction = Transaction.from(base64ToBytes(built.transactionBase64));
      const signed = await signTransaction(transaction);

      setStep("submitting");
      const sent = await apiRequest<SendTransactionResponse>("/transactions/send", {
        method: "POST",
        body: JSON.stringify({ transactionBase64: bytesToBase64(signed.serialize()) }),
      });

      if (currentAction === "add_signer") {
        await apiRequest("/settings/add-signer/submitted", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            signer: hydratedPreview?.signer ?? draft.signer,
            name: draft.name,
            email: draft.email,
            designation: draft.designation,
            permissionsMask: hydratedPreview?.permissionsMask ?? Number(draft.permissionsMask),
            txSig: sent.txSig,
          }),
        });
      } else if (currentAction === "remove_signer") {
        await apiRequest("/settings/remove-signer/submitted", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            signer: hydratedPreview?.signer ?? draft.signer,
            txSig: sent.txSig,
          }),
        });
      } else if (currentAction === "change_threshold") {
        await apiRequest("/settings/change-threshold/submitted", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            settingsPda: settingsAccount.pda,
            newThreshold: hydratedPreview?.requestedThreshold ?? Number(draft.newThreshold),
            txSig: sent.txSig,
          }),
        });
      } else {
        await apiRequest("/smart-accounts/fund/submitted", {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            smartAccountPda: hydratedPreview?.smartAccountPda ?? selectedSmartAccount?.pda,
            amountLamports:
              hydratedPreview?.amountLamports ??
              String(Math.round(Number(draft.amountSol) * 1_000_000_000)),
            txSig: sent.txSig,
          }),
        });
      }

      setLastTx(sent.txSig);
      setStep("implemented");
      setDraft(initialDraft);
      await onRefresh?.();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Settings action failed");
    }
  }

  return (
    <div className="relative w-full max-w-[760px]">
      {receipt && (
        <ReceiptCard
          receipt={receipt}
          draft={receiptDraft}
          step={receiptStep}
          error={receiptError}
          lastTx={lastTx}
          walletAddress={walletAddress}
          smartAccounts={settingsAccount?.smartAccounts ?? []}
          canExecute={canExecute}
          onDraftChange={updateReceiptDraft}
          onConfirm={() => void prepareReceiptPayment()}
          onDismiss={() => {
            setReceipt(null);
            setReceiptStep("idle");
            setReceiptError("");
          }}
        />
      )}

      {agentResponse && !receipt && (
        <AgentCard
          response={agentResponse}
          step={step}
          draft={draft}
          error={error}
          lastTx={lastTx}
          preview={hydratedPreview}
          canExecute={canExecute}
          signerDraftComplete={signerDraftComplete}
          onDraftChange={updateDraft}
          onFieldsSubmit={openPreviewFromFields}
          onConfirm={() => void executePreview()}
          onDismiss={() => {
            setAgentResponse(null);
            setStep("idle");
            setError("");
          }}
        />
      )}

      <div className="relative h-[136px] rounded-[26px] border border-[#3a3938] bg-[#1e1d1c] px-5 pb-4 pt-5 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleReceiptUpload(file);
          }}
        />
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder={
            searchMode === "Settings"
              ? "Ask about signers, permissions, threshold..."
              : "Ask anything..."
          }
          rows={2}
          className="w-full resize-none bg-transparent text-[17px] leading-6 text-[#eeeeee] outline-none placeholder:text-[#777574] focus-visible:ring-0"
        />

        <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex size-10 items-center justify-center rounded-full text-[#aaa9a8] transition hover:bg-[#292827] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Upload receipt"
            >
              <Plus size={21} strokeWidth={1.7} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                className="flex h-10 items-center gap-2 rounded-full border border-[#41403f] bg-[#211f1e] px-3.5 text-[14px] text-[#dedddb] transition hover:bg-[#292827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-expanded={searchOpen}
              >
                <span>{searchMode}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${searchOpen ? "rotate-180" : ""}`}
                />
              </button>

              {searchOpen && (
                <div className="absolute bottom-12 left-0 z-50 w-72 overflow-hidden rounded-[18px] border border-[#3c3b3a] bg-[#211f1e] p-1.5 shadow-[0_15px_50px_rgba(0,0,0,0.4)]">
                  {searchOptions.map((option) => (
                    <button
                      key={option.name}
                      type="button"
                      disabled={option.locked}
                      onClick={() => {
                        if (!option.locked) {
                          setSearchMode(option.name);
                          setSearchOpen(false);
                        }
                      }}
                      className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                        option.locked
                          ? "cursor-not-allowed text-[#858382]"
                          : "text-[#dedddb] hover:bg-[#2b2928]"
                      }`}
                    >
                      <span className="flex-1 text-[14px]">{option.name}</span>
                      {option.locked ? (
                        <Lock size={16} className="text-[#858382]" />
                      ) : (
                        searchMode === option.name && <Check size={18} className="text-[#55c9dc]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!message.trim() || isBusy}
            className="flex size-10 items-center justify-center rounded-full bg-[#e7e7e7] text-[#171615] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            {isBusy ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <ArrowRight size={20} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptCard({
  receipt,
  draft,
  step,
  error,
  lastTx,
  walletAddress,
  smartAccounts,
  canExecute,
  onDraftChange,
  onConfirm,
  onDismiss,
}: {
  receipt: ReceiptRecord;
  draft: typeof initialReceiptDraft;
  step: ReceiptStep;
  error: string;
  lastTx: string;
  walletAddress: string;
  smartAccounts: SmartAccount[];
  canExecute: boolean;
  onDraftChange: (name: keyof typeof initialReceiptDraft, value: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const isBusy = ["uploading", "preparing", "wallet", "submitting"].includes(step);
  const fileHref = `${API_BASE}${receipt.fileUrl}?walletAddress=${encodeURIComponent(walletAddress)}`;

  return (
    <div className="absolute bottom-[150px] left-1/2 z-30 max-h-[54vh] w-[min(calc(100vw-2rem),560px)] -translate-x-1/2 overflow-y-auto rounded-[22px] border border-neutral-200 bg-[#f0f0ee] p-4 text-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
          <FileText size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold tracking-[-0.01em]">Receipt review</p>
              <p className="mt-1 text-[13px] leading-5 text-neutral-600">
                Check the extracted bill details, choose a source account, then prepare the payment.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-10 min-w-10 items-center justify-center rounded-full text-[13px] text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-500">
              <span className="relative flex size-2">
                {isBusy && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-neutral-950 opacity-25" />
                )}
                <span className="relative inline-flex size-2 rounded-full bg-neutral-950" />
              </span>
              {receiptStatusCopy(step)}
            </div>
            <a
              href={fileHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[12px] font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              <Eye size={14} />
              Open bill
            </a>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReceiptField
                label="Vendor"
                value={draft.vendor}
                onChange={(value) => onDraftChange("vendor", value)}
              />
              <ReceiptField
                label="Bill amount"
                value={draft.amount}
                onChange={(value) => onDraftChange("amount", value)}
              />
              <ReceiptField
                label="Currency"
                value={draft.currency}
                onChange={(value) => onDraftChange("currency", value)}
              />
              <ReceiptField
                label="Due date"
                value={draft.dueDate}
                onChange={(value) => onDraftChange("dueDate", value)}
                type="date"
              />
              <ReceiptField
                label="Invoice number"
                value={draft.invoiceNumber}
                onChange={(value) => onDraftChange("invoiceNumber", value)}
              />
              <ReceiptField
                label="Category"
                value={draft.category}
                onChange={(value) => onDraftChange("category", value)}
              />
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-[12px] font-medium text-neutral-500">
                  Pay from
                  <select
                    value={draft.smartAccountId}
                    onChange={(event) => onDraftChange("smartAccountId", event.target.value)}
                    className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-950 outline-none focus:border-neutral-400"
                  >
                    <option value="">Choose smart account</option>
                    {smartAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>
                <ReceiptField
                  label="SOL amount to prepare"
                  value={draft.amountSol}
                  onChange={(value) => onDraftChange("amountSol", value)}
                  type="number"
                />
                <div className="sm:col-span-2">
                  <ReceiptField
                    label="Recipient wallet"
                    value={draft.recipient}
                    onChange={(value) => onDraftChange("recipient", value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <ReceiptField
                    label="Memo"
                    value={draft.memo}
                    onChange={(value) => onDraftChange("memo", value)}
                  />
                </div>
              </div>
            </div>

            {receipt.confidence != null && (
              <p className="text-[12px] text-neutral-500">
                OCR confidence: {Math.round(Number(receipt.confidence) * 100)}%
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                {error}
              </p>
            )}
            {lastTx && (
              <p className="truncate rounded-xl bg-emerald-50 px-3 py-2 font-mono text-[12px] text-emerald-700">
                tx {shortAddress(lastTx)}
              </p>
            )}

            <button
              type="button"
              onClick={onConfirm}
              disabled={!canExecute || isBusy || step === "implemented"}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isBusy ? <Loader2 className="animate-spin" size={15} /> : <ShieldCheck size={15} />}
              {step === "implemented" ? "Payment prepared" : "Prepare payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-[12px] font-medium text-neutral-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-950 outline-none focus:border-neutral-400"
      />
    </label>
  );
}

function AgentCard({
  response,
  step,
  draft,
  error,
  lastTx,
  preview,
  canExecute,
  signerDraftComplete,
  onDraftChange,
  onFieldsSubmit,
  onConfirm,
  onDismiss,
}: {
  response: AgentResponse;
  step: StepState;
  draft: DraftFields;
  error: string;
  lastTx: string;
  preview: AgentResponse["preview"] | null;
  canExecute: boolean;
  signerDraftComplete: boolean;
  onDraftChange: (name: keyof DraftFields, value: string) => void;
  onFieldsSubmit: (event: FormEvent<HTMLFormElement>) => boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [response]);

  if (step === "implemented") {
    return (
      <div className="absolute bottom-[150px] left-1/2 z-30 w-[min(calc(100vw-2rem),420px)] -translate-x-1/2 rounded-[22px] border border-neutral-200 bg-[#f0f0ee] p-4 text-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold">Implemented</p>
                <p className="mt-1 text-[13px] leading-5 text-neutral-600">
                  The change was confirmed successfully.
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-10 min-w-10 items-center justify-center rounded-full text-[13px] text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
              >
                Close
              </button>
            </div>

            {lastTx && (
              <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
                <ShieldCheck size={14} />
                Indexed transaction {shortAddress(lastTx)}
              </p>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
            >
              <Check size={15} />
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showFields = step === "needs_fields" || editing;
  const showPreview =
    !editing && (step === "preview" || ["preparing", "wallet", "submitting"].includes(step));
  const selectedSmartAccount = response.smartAccounts?.find(
    (account) => account.id === (preview?.smartAccountId ?? draft.smartAccountId),
  );
  const selectedTransaction = response.transactions?.find(
    (transaction) => transaction.id === (preview?.transactionRecordId ?? draft.transactionRecordId),
  );

  return (
    <div className="absolute bottom-[150px] left-1/2 z-30 max-h-[46vh] w-[min(calc(100vw-2rem),520px)] -translate-x-1/2 overflow-y-auto rounded-[22px] border border-neutral-200 bg-[#f0f0ee] p-4 text-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
          {response.action === "add_signer" ||
          response.action === "create_smart_account" ||
          response.action === "fund_smart_account" ? (
            <UserPlus size={17} />
          ) : (
            <Sparkles size={17} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold tracking-[-0.01em]">{response.title}</p>
              <p className="mt-1 text-[13px] leading-5 text-neutral-600">{response.message}</p>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-10 min-w-10 items-center justify-center rounded-full text-[13px] text-neutral-500 transition hover:bg-black/5 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12px] font-medium text-neutral-500">
              <span className="relative flex size-2">
                {["preparing", "wallet", "submitting"].includes(step) && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-neutral-950 opacity-25" />
                )}
                <span className="relative inline-flex size-2 rounded-full bg-neutral-950" />
              </span>
              {editing ? "Editing signer details" : statusCopy(step)}
            </div>
            {response.action === "add_signer" && showPreview && step === "preview" && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 text-[12px] font-semibold text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
              >
                <Pencil size={13} />
                Edit details
              </button>
            )}
          </div>

          {showFields && (
            <form
              onSubmit={(event) => {
                if (onFieldsSubmit(event)) setEditing(false);
              }}
              className="mt-4 grid gap-3"
            >
              {response.fields?.map((field) => (
                <FieldControl
                  key={field.name}
                  field={field}
                  value={draft[field.name]}
                  onChange={(value) => onDraftChange(field.name, value)}
                  smartAccounts={response.smartAccounts}
                  transactions={response.transactions}
                />
              ))}
              <button
                type="submit"
                className="mt-1 flex h-11 items-center justify-center rounded-xl bg-neutral-950 px-4 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
              >
                {editing ? "Review changes" : "Review action"}
              </button>
            </form>
          )}

          {showPreview && preview && (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3">
              <div className="grid gap-2 text-[12.5px]">
                {response.action === "add_signer" && (
                  <>
                    <ReviewRow label="Signer" value={shortAddress(preview.signer)} mono />
                    <ReviewRow label="Name" value={draft.name || "Not set"} />
                    <ReviewRow label="Email" value={draft.email || "Not set"} />
                    <ReviewRow label="Role" value={draft.designation || "Not set"} />
                    <ReviewRow
                      label="Can do"
                      value={<PermissionChips mask={preview.permissionsMask} />}
                    />
                    <ReviewRow
                      label="Signer count"
                      value={`${preview.currentSignerCount ?? 0} -> ${preview.expectedSignerCount ?? 0}`}
                    />
                  </>
                )}
                {response.action === "remove_signer" && (
                  <>
                    <ReviewRow label="Signer" value={shortAddress(preview.signer)} mono />
                    <ReviewRow
                      label="Signer count"
                      value={`${preview.currentSignerCount ?? 0} -> ${preview.expectedSignerCount ?? 0}`}
                    />
                    <ReviewRow label="Threshold" value={String(preview.currentThreshold ?? "-")} />
                  </>
                )}
                {response.action === "change_threshold" && (
                  <>
                    <ReviewRow
                      label="Current threshold"
                      value={String(preview.currentThreshold ?? "-")}
                    />
                    <ReviewRow
                      label="New threshold"
                      value={String(preview.requestedThreshold ?? "-")}
                    />
                    <ReviewRow
                      label="Vote-enabled signers"
                      value={String(preview.voteSignerCount ?? "-")}
                    />
                  </>
                )}
                {response.action === "create_smart_account" && (
                  <>
                    <ReviewRow
                      label="Account name"
                      value={preview.smartAccountName ?? (draft.smartAccountName || "Not set")}
                    />
                    <ReviewRow label="Account index" value={`#${preview.accountIndex ?? 0}`} mono />
                    <ReviewRow label="Purpose" value="Create an indexed smart account PDA" />
                  </>
                )}
                {response.action === "fund_smart_account" && (
                  <>
                    <ReviewRow
                      label="Smart account"
                      value={
                        preview.smartAccountName ?? selectedSmartAccount?.name ?? "Selected account"
                      }
                    />
                    <ReviewRow
                      label="Destination PDA"
                      value={shortAddress(preview.smartAccountPda ?? selectedSmartAccount?.pda)}
                      mono
                    />
                    <ReviewRow
                      label="Amount"
                      value={`${preview.amountSol ?? draft.amountSol} SOL`}
                      mono
                    />
                    <ReviewRow
                      label="Current balance"
                      value={lamportsToSol(
                        preview.currentBalanceLamports ?? selectedSmartAccount?.balanceLamports,
                      )}
                      mono
                    />
                  </>
                )}
                {response.action === "create_transaction" && (
                  <>
                    <ReviewRow
                      label="Source account"
                      value={
                        preview.smartAccountName ?? selectedSmartAccount?.name ?? "Selected account"
                      }
                    />
                    <ReviewRow
                      label="Recipient"
                      value={shortAddress(preview.recipient ?? draft.recipient)}
                      mono
                    />
                    <ReviewRow
                      label="Amount"
                      value={`${preview.amountSol ?? draft.amountSol} SOL`}
                      mono
                    />
                    <ReviewRow
                      label="Memo"
                      value={preview.memo ?? (draft.memo || "Agent payment")}
                    />
                    <ReviewRow label="What happens" value="Create transaction + proposal" />
                  </>
                )}
                {(response.action === "approve_transaction" ||
                  response.action === "execute_transaction") && (
                  <>
                    <ReviewRow
                      label="Transaction"
                      value={`#${preview.transactionIndex ?? selectedTransaction?.transactionIndex ?? "-"}`}
                      mono
                    />
                    <ReviewRow
                      label="Status"
                      value={preview.status ?? selectedTransaction?.status ?? "-"}
                    />
                    <ReviewRow
                      label="Smart account"
                      value={
                        preview.smartAccountName ?? selectedTransaction?.smartAccountName ?? "-"
                      }
                    />
                    <ReviewRow
                      label="Recipient"
                      value={shortAddress(preview.recipient ?? selectedTransaction?.recipient)}
                      mono
                    />
                    <ReviewRow
                      label="Amount"
                      value={lamportsToSol(
                        preview.amountLamports ?? selectedTransaction?.amountLamports,
                      )}
                      mono
                    />
                    {response.action === "approve_transaction" && (
                      <ReviewRow
                        label="Approvals"
                        value={`${preview.approvalCount ?? selectedTransaction?.approvalCount ?? 0} of ${preview.threshold ?? "-"}`}
                      />
                    )}
                  </>
                )}
                {(preview.authoritySignatureRequired || preview.walletSignatureRequired) && (
                  <ReviewRow
                    label={
                      preview.walletSignatureRequired ? "Wallet transfer" : "Authority signature"
                    }
                    value="Required"
                  />
                )}
              </div>
            </div>
          )}

          {response.kind === "answer" && (
            <div className="mt-4 grid gap-2">
              {response.rows?.map((row) => (
                <ReviewRow key={row.label} label={row.label} value={row.value} />
              ))}
              {summaryEntries(response.summary).map(([label, value]) => (
                <ReviewRow
                  key={label}
                  label={displayLabel(label)}
                  value={displayValue(label, String(value))}
                  mono={
                    label.toLowerCase().includes("pda") || label.toLowerCase().includes("authority")
                  }
                />
              ))}
              {response.summary?.connectedWalletIsSigner !== undefined && (
                <p className="px-1 pt-1 text-[12px] leading-5 text-neutral-500">
                  Your connected wallet is {response.summary.connectedWalletIsSigner ? "" : "not "}
                  part of this signer set.
                </p>
              )}
              {response.signers?.slice(0, 5).map((signer) => (
                <div
                  key={signer.walletAddress}
                  className="grid grid-cols-[minmax(150px,1fr)_auto] items-center gap-3 rounded-xl bg-white px-3 py-2"
                >
                  <span className="min-w-0 truncate text-neutral-500">Signer: {signer.name}</span>
                  <div className="flex min-w-0 flex-col items-end gap-1">
                    <span className="font-mono text-[12px] text-neutral-900">
                      {shortAddress(signer.walletAddress)}
                    </span>
                    <PermissionChips mask={signer.permissionsMask} />
                  </div>
                </div>
              ))}
              {response.smartAccounts?.slice(0, 5).map((account) => (
                <ReviewRow
                  key={account.id}
                  label={account.name}
                  value={`index #${account.accountIndex} · ${lamportsToSol(account.balanceLamports)}`}
                  mono
                />
              ))}
              {response.transactions?.slice(0, 5).map((transaction) => (
                <ReviewRow
                  key={transaction.id}
                  label={`Tx #${transaction.transactionIndex}`}
                  value={`${transaction.status} · ${lamportsToSol(transaction.amountLamports)}`}
                  mono
                />
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] leading-5 text-red-700">
              {error || response.message}
            </p>
          )}

          {lastTx && (
            <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">
              <ShieldCheck size={14} />
              Indexed transaction {shortAddress(lastTx)}
            </p>
          )}

          {showPreview && !editing && response.status === "ready" && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={
                !canExecute ||
                (response.action === "add_signer" && !signerDraftComplete) ||
                ["preparing", "wallet", "submitting"].includes(step)
              }
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {["preparing", "wallet", "submitting"].includes(step) ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <ShieldCheck size={15} />
              )}
              Confirm with wallet
            </button>
          )}
          {showPreview && response.action === "add_signer" && !signerDraftComplete && (
            <p className="mt-2 text-center text-[11px] font-medium text-neutral-500">
              Add the signer name, email, role, and at least one permission to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  smartAccounts = [],
  transactions = [],
}: {
  field: AgentField;
  value: string;
  onChange: (value: string) => void;
  smartAccounts?: SmartAccount[];
  transactions?: TransactionRecord[];
}) {
  const id = `settings-agent-${field.name}`;

  if (field.name === "smartAccountId") {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-[12px] font-medium text-neutral-600">
        {field.label}
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
        >
          <option value="">Choose account</option>
          {smartAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} / index #{account.accountIndex} /{" "}
              {lamportsToSol(account.balanceLamports)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.name === "transactionRecordId") {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-[12px] font-medium text-neutral-600">
        {field.label}
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
        >
          <option value="">Choose transaction</option>
          {transactions.map((transaction) => (
            <option key={transaction.id} value={transaction.id}>
              #{transaction.transactionIndex} / {transaction.status} /{" "}
              {lamportsToSol(transaction.amountLamports)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.name === "period") {
    return (
      <label htmlFor={id} className="grid gap-1.5 text-[12px] font-medium text-neutral-600">
        {field.label}
        <select
          id={id}
          value={value || "MONTH"}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
        >
          <option value="ONE_TIME">One time</option>
          <option value="DAY">Daily</option>
          <option value="WEEK">Weekly</option>
          <option value="MONTH">Monthly</option>
        </select>
      </label>
    );
  }

  if (field.name === "permissionsMask") {
    const permissionOptions = [
      { bit: 1, label: "Initiate", description: "Create payment proposals" },
      { bit: 2, label: "Approve", description: "Vote on proposals" },
      { bit: 4, label: "Execute", description: "Execute approved payments" },
    ];
    const mask = Number(value || 0);
    return (
      <fieldset className="grid gap-2">
        <legend className="text-[12px] font-medium text-neutral-600">{field.label}</legend>
        <div className="grid grid-cols-3 gap-2">
          {permissionOptions.map((permission) => {
            const checked = (mask & permission.bit) !== 0;
            return (
              <label
                key={permission.bit}
                className={`flex min-h-16 cursor-pointer items-start gap-2 rounded-xl border p-2.5 transition ${checked ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(String(checked ? mask & ~permission.bit : mask | permission.bit))
                  }
                  className="mt-0.5 size-3.5 accent-neutral-950"
                />
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold">{permission.label}</span>
                  <span
                    className={`mt-0.5 block text-[10px] leading-3.5 ${checked ? "text-neutral-300" : "text-neutral-400"}`}
                  >
                    {permission.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <label htmlFor={id} className="grid gap-1.5 text-[12px] font-medium text-neutral-600">
      {field.label}
      <input
        id={id}
        type={field.type === "email" ? "email" : "text"}
        inputMode={
          field.name === "newThreshold"
            ? "numeric"
            : field.name === "amountSol"
              ? "decimal"
              : undefined
        }
        autoComplete={field.type === "email" ? "email" : field.name === "name" ? "name" : "off"}
        spellCheck={false}
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          field.name === "signer"
            ? "Solana wallet address"
            : field.name === "newThreshold"
              ? "2"
              : field.name === "amountSol"
                ? "30"
                : field.name === "recipient"
                  ? "Recipient wallet address"
                  : field.name === "memo"
                    ? "Payroll payment"
                    : field.name === "smartAccountName"
                      ? "Salaries"
                      : ""
        }
        className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-neutral-950 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40"
      />
    </label>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(150px,1fr)_auto] items-center gap-3 rounded-xl bg-white px-3 py-2">
      <span className="min-w-0 truncate text-neutral-500">{label}</span>
      <div
        className={`min-w-0 text-right text-neutral-900 ${mono ? "truncate font-mono text-[12px]" : "font-medium"}`}
      >
        {value}
      </div>
    </div>
  );
}

export default ChatInput;
