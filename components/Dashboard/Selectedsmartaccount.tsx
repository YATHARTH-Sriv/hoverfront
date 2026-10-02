import {
  ReceiptRecord,
  SettingsSigner,
  SmartAccount,
  SmartAccountTab,
  TransactionRecord,
} from "@/types";
import { Panel, SummaryPanel } from "./Panel";
import { ReceiptList } from "./Receiptlist";
import { TransactionList } from "./Txnlist";
import { formatSol } from "./helpers";
import { Check, Copy } from "lucide-react";

function SelectedSmartAccountView({
  account,
  transactions,
  receipts,
  selectedTab,
  threshold,
  currentSigner,
  copied,
  walletAddress,
  acting,
  onBack,
  onCopy,
  onOpenReceipt,
  onDeleteReceipt,
  onPrepareReceiptPayment,
  onApprove,
  onReject,
  onExecute,
  onTabChange,
}: {
  account: SmartAccount;
  transactions: TransactionRecord[];
  receipts: ReceiptRecord[];
  selectedTab: SmartAccountTab;
  threshold: number;
  currentSigner?: SettingsSigner;
  copied: string;
  walletAddress: string;
  acting: string;
  onBack: () => void;
  onCopy: (value: string) => Promise<void>;
  onOpenReceipt: (receipt: ReceiptRecord) => void;
  onDeleteReceipt: (receipt: ReceiptRecord) => void;
  onPrepareReceiptPayment: (receipt: ReceiptRecord) => void;
  onApprove: (transaction: TransactionRecord) => Promise<void>;
  onReject: (transaction: TransactionRecord) => Promise<void>;
  onExecute: (transaction: TransactionRecord) => Promise<void>;
  onTabChange: (tab: SmartAccountTab) => void;
}) {
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full border border-neutral-200 px-4 py-2 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-950"
      >
        All smart accounts
      </button>

      <div className="rounded-3xl bg-neutral-950 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.14)]">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-white/40">
              Selected vault
            </p>
            <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.04em]">{account.name}</h2>
            <p className="mt-1 font-mono text-[13px] text-white/45">
              account index #{account.accountIndex}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[12.5px] text-white/45">Balance</p>
            <p className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">
              {formatSol(account.balanceLamports)}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/4 p-4">
          <p className="text-[12.5px] text-white/40">Smart account PDA</p>
          <div className="mt-3 flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/85">
              {account.pda}
            </p>
            <button
              type="button"
              onClick={() => void onCopy(account.pda)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={`Copy ${account.name} smart account PDA`}
            >
              {copied === account.pda ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {selectedTab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SummaryPanel
            title="Review"
            description="Bills waiting for supervision."
            count={receipts.length}
            onMore={() => onTabChange("review")}
          >
            <ReceiptList
              receipts={receipts.slice(0, 4)}
              onOpenReceipt={onOpenReceipt}
              onDeleteReceipt={onDeleteReceipt}
              onPreparePayment={onPrepareReceiptPayment}
            />
          </SummaryPanel>
          <SummaryPanel
            title="Transactions"
            description="Recent proposals and payments."
            count={transactions.length}
            onMore={() => onTabChange("transactions")}
          >
            <TransactionList
              transactions={transactions.slice(0, 4)}
              threshold={threshold}
              walletAddress={walletAddress}
              currentSigner={currentSigner}
              acting={acting}
              onApprove={onApprove}
              onReject={onReject}
              onExecute={onExecute}
              variant="summary"
            />
          </SummaryPanel>
        </div>
      )}

      {selectedTab === "review" && (
        <Panel
          title={`${account.name} review`}
          description="Captured bills that need approval before payment proposals are prepared."
        >
          <ReceiptList
            receipts={receipts}
            onOpenReceipt={onOpenReceipt}
            onDeleteReceipt={onDeleteReceipt}
            onPreparePayment={onPrepareReceiptPayment}
          />
        </Panel>
      )}

      {selectedTab === "receipts" && (
        <Panel
          title={`${account.name} receipts`}
          description="All non-archived bills matched to this smart account."
        >
          <ReceiptList
            receipts={receipts}
            onOpenReceipt={onOpenReceipt}
            onPreparePayment={onPrepareReceiptPayment}
          />
        </Panel>
      )}

      {selectedTab === "transactions" && (
        <Panel
          title={`${account.name} transactions`}
          description="Only transactions created from this smart account are shown here."
        >
          <TransactionList
            transactions={transactions}
            threshold={threshold}
            walletAddress={walletAddress}
            currentSigner={currentSigner}
            acting={acting}
            onApprove={onApprove}
            onReject={onReject}
            onExecute={onExecute}
            variant="summary"
          />
        </Panel>
      )}
    </div>
  );
}

export { SelectedSmartAccountView };
