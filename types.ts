type DashboardResponse = {
  walletAddress: string | null;
  settings: SettingsAccount[];
};

type SettingsAccount = {
  id: string;
  name: string;
  pda: string;
  settingsAuthority: string;
  threshold: number;
  timeLock: number;
  transactionIndex: string | number;
  staleTransactionIndex: string | number;
  signers: SettingsSigner[];
  smartAccounts: SmartAccount[];
  transactions: TransactionRecord[];
  receipts: ReceiptRecord[];
  activities: ActivityLog[];
};

type SettingsSigner = {
  id: string;
  role: string;
  label: string | null;
  name?: string | null;
  email?: string | null;
  designation?: string | null;
  walletLabel?: string | null;
  walletAddress: string;
  permissionsMask: number;
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
  createdAt?: string | null;
};

type TransactionRecord = {
  id: string;
  status: string;
  transactionIndex: string | number;
  smartAccountId?: string | null;
  smartAccountPda?: string | null;
  accountIndex?: number | null;
  recipient: string | null;
  amountLamports: string | number;
  memo: string | null;
  createdAt?: string | null;
  approvals: { walletAddress: string; status: string }[];
  isStale?: boolean;
  staleReason?: string | null;
  receipt?: ReceiptRecord | null;
  payout?: {
    payoutId: string;
    title: string;
    description?: string | null;
    category: string;
    recipientName: string;
    recipientMemo?: string | null;
  } | null;
};

type ActivityLog = {
  id: string;
  type?: string;
  action?: string;
  title?: string;
  message?: string;
  description?: string;
  status?: string;
  createdAt: string;
};

type SmartAccountResponse = {
  smartAccount: SmartAccount;
};

type BuildSignedTransactionResponse = {
  transactionBase64: string;
  transactionIndex?: string | number;
  transactionPda?: string;
  proposalPda?: string;
  smartAccountPda?: string;
  settingsPda?: string;
  accountIndex?: number;
  recipient?: string;
  amountLamports?: string | number;
  memo?: string;
};

type SendTransactionResponse = {
  txSig: string;
};

type WalletSubmittedResponse = {
  transaction: TransactionRecord;
};

type InviteDetails = {
  token: string;
  inviteUrl: string;
  status: string;
  walletAddress: string;
  email?: string | null;
  name?: string | null;
  designation?: string | null;
};

type AddSignerSubmittedResponse = {
  settings: SettingsAccount | null;
  invite?: InviteDetails;
};

type ActiveSection =
  "dashboard" | "accounts" | "transactions" | "invoices" | "payouts" | "settings";

type CustomerRecord = {
  id: string;
  workspaceId: string;
  businessName: string;
  billingEmail?: string | null;
  contactName?: string | null;
  walletAddress?: string | null;
};

type InvoiceLineItem = {
  id?: string;
  position?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  amount?: string;
};

type InvoicePayment = {
  id: string;
  payerWallet: string;
  amountLamports: string;
  txSig: string;
  confirmedAt: string;
};

type InvoiceRecord = {
  id: string;
  workspaceId: string;
  customerId: string;
  receivingSmartAccountId: string;
  invoiceNumber: number;
  status: string;
  currency: "SOL";
  issueDate: string;
  dueDate?: string | null;
  customerBusinessName: string;
  customerBillingEmail?: string | null;
  customerContactName?: string | null;
  customerWalletAddress?: string | null;
  memo?: string | null;
  subtotal: string;
  total: string;
  amountPaid: string;
  createdByWallet: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  viewedAt?: string | null;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
};

type PayoutRecipient = {
  id: string;
  position: number;
  name: string;
  walletAddress: string;
  amountLamports: string;
  memo?: string | null;
  transactionRecordId?: string | null;
  transactionStatus?: string | null;
  transactionIndex?: string | null;
  proposalPda?: string | null;
  executeTxSig?: string | null;
};

type PayoutRecord = {
  id: string;
  workspaceId: string;
  smartAccountId: string;
  smartAccountName: string;
  accountIndex: number;
  title: string;
  description?: string | null;
  category: string;
  status: string;
  totalLamports: string;
  createdByWallet: string;
  createdAt: string;
  updatedAt: string;
  recipients: PayoutRecipient[];
};
type SmartAccountTab = "overview" | "review" | "receipts" | "transactions";

export type {
  SmartAccountTab,
  DashboardResponse,
  ActiveSection,
  AddSignerSubmittedResponse,
  InviteDetails,
  WalletSubmittedResponse,
  SendTransactionResponse,
  BuildSignedTransactionResponse,
  SmartAccountResponse,
  SettingsAccount,
  ReceiptRecord,
  TransactionRecord,
  SettingsSigner,
  SmartAccount,
  ActivityLog,
  CustomerRecord,
  InvoiceLineItem,
  InvoicePayment,
  InvoiceRecord,
  PayoutRecipient,
  PayoutRecord,
};
