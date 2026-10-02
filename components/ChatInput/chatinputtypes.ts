import { Transaction } from "@solana/web3.js";

type SettingsSigner = {
  id?: string;
  role?: string;
  label?: string | null;
  name?: string | null;
  email?: string | null;
  designation?: string | null;
  walletAddress: string;
  permissionsMask: number;
};

type SettingsAccount = {
  pda: string;
  settingsAuthority: string;
  threshold: number;
  timeLock: number;
  transactionIndex: string | number;
  staleTransactionIndex: string | number;
  signers: SettingsSigner[];
  smartAccounts?: SmartAccount[];
};

type SmartAccount = {
  id: string;
  name: string;
  accountIndex: number;
  pda: string;
  balanceLamports: string | number;
  receipts?: ReceiptRecord[];
};

type ReceiptRecord = {
  id: string;
  settingsAccountId: string;
  smartAccountId?: string | null;
  transactionRecordId?: string | null;
  fileUrl: string;
  fileName?: string | null;
  fileMimeType?: string | null;
  vendor?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  dueDate?: string | null;
  invoiceNumber?: string | null;
  category?: string | null;
  paymentRecipient?: string | null;
  confidence?: number | null;
  status: string;
};

type ChatInputProps = {
  settingsAccount?: SettingsAccount | null;
  walletAddress?: string;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
  onRefresh?: () => Promise<void>;
  onError?: (message: string) => void;
};

type AgentField = {
  name:
    | "signer"
    | "name"
    | "email"
    | "designation"
    | "permissionsMask"
    | "newThreshold"
    | "smartAccountName"
    | "smartAccountId"
    | "amountSol"
    | "recipient"
    | "memo"
    | "period"
    | "transactionRecordId";
  label: string;
  type: string;
  required?: boolean;
};

type AgentResponse = {
  kind: "answer" | "needs_fields" | "preview";
  status: "ready" | "blocked" | "needs_settings";
  action?:
    | "add_signer"
    | "change_threshold"
    | "change_timelock"
    | "remove_signer"
    | "create_smart_account"
    | "fund_smart_account"
    | "create_transaction"
    | "approve_transaction"
    | "execute_transaction";
  title: string;
  message: string;
  fields?: AgentField[];
  rows?: Array<{ label: string; value: string }>;
  summary?: Record<string, string | number | boolean | null>;
  signers?: Array<{
    name: string;
    designation: string;
    walletAddress: string;
    permissionsMask: number;
    permissions: string[];
  }>;
  smartAccounts?: SmartAccount[];
  transactions?: TransactionRecord[];
  preview?: {
    settingsPda?: string;
    signer?: string | null;
    name?: string | null;
    email?: string | null;
    designation?: string | null;
    permissionsMask?: number;
    currentThreshold?: number;
    requestedThreshold?: number | null;
    currentSignerCount?: number;
    expectedSignerCount?: number;
    voteSignerCount?: number;
    valid?: boolean | null;
    authoritySignatureRequired?: boolean;
    currentTimeLock?: number;
    requestedTimeLock?: number | null;
    smartAccountId?: string | null;
    smartAccountName?: string | null;
    smartAccountPda?: string | null;
    accountIndex?: number;
    amountSol?: number | null;
    amountLamports?: string | null;
    currentBalanceLamports?: string | null;
    walletSignatureRequired?: boolean;
    transactionRecordId?: string | null;
    transactionIndex?: string | null;
    status?: string | null;
    recipient?: string | null;
    memo?: string | null;
    approvalCount?: number | null;
    threshold?: number | null;
    requiresProposal?: boolean;
    period?: string | null;
    seed?: string | null;
  };
};

type TransactionRecord = {
  id: string;
  transactionIndex: string;
  status: string;
  smartAccountId?: string | null;
  smartAccountName?: string | null;
  smartAccountPda?: string | null;
  accountIndex?: number | null;
  recipient?: string | null;
  amountLamports: string;
  memo?: string | null;
  approvalCount?: number;
  approvedByWallet?: boolean;
  isStale?: boolean;
  staleReason?: string | null;
};

type DraftFields = {
  signer: string;
  name: string;
  email: string;
  designation: string;
  permissionsMask: string;
  newThreshold: string;
  smartAccountName: string;
  smartAccountId: string;
  amountSol: string;
  recipient: string;
  memo: string;
  period: string;
  transactionRecordId: string;
};

type StepState =
  | "idle"
  | "thinking"
  | "needs_fields"
  | "preview"
  | "preparing"
  | "wallet"
  | "submitting"
  | "implemented"
  | "error";
type ReceiptStep =
  "idle" | "uploading" | "review" | "preparing" | "wallet" | "submitting" | "implemented" | "error";

type BuildSignedTransactionResponse = {
  transactionBase64: string;
  transactionIndex?: string | number;
  transactionPda?: string;
  proposalPda?: string;
  smartAccountPda?: string;
  accountIndex?: number;
  recipient?: string;
  amountLamports?: string | number;
  memo?: string;
  seed?: string;
  period?: string;
  smartAccountId?: string;
  signers?: string[];
  destinations?: string[];
};

type SendTransactionResponse = {
  txSig: string;
};

export type {
  SmartAccount,
  AgentField,
  ReceiptRecord,
  SendTransactionResponse,
  BuildSignedTransactionResponse,
  StepState,
  ReceiptStep,
  DraftFields,
  TransactionRecord,
  ChatInputProps,
  AgentResponse,
};
