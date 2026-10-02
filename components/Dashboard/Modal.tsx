import { ReceiptRecord, SettingsAccount, SmartAccount } from "@/types";
import { humanStatus, PermissionChips, shortAddress, TextField } from "./helpers";
import { Check, Copy, Loader2, Send, UserPlus } from "lucide-react";
import { API_BASE } from "@/constant";
import Image from "next/image";

function AddSignerModal({
  acting,
  step,
  settingsAccount,
  signerName,
  signerDesignation,
  signerEmail,
  signerAddress,
  signerPermissions,
  inviteUrl,
  copied,
  onStepChange,
  onNameChange,
  onDesignationChange,
  onEmailChange,
  onAddressChange,
  onPermissionsChange,
  onClose,
  onCopy,
  onSubmit,
}: {
  acting: string;
  step: number;
  settingsAccount?: SettingsAccount;
  signerName: string;
  signerDesignation: string;
  signerEmail: string;
  signerAddress: string;
  signerPermissions: string;
  inviteUrl: string;
  copied: string;
  onStepChange: (step: number) => void;
  onNameChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onPermissionsChange: (value: string) => void;
  onClose: () => void;
  onCopy: (value: string) => Promise<void>;
  onSubmit: () => void;
}) {
  const isSubmitting = acting === "add-signer";
  const canContinue = signerName.trim().length > 0;
  const canSubmit = signerName.trim().length > 0 && signerAddress.trim().length > 0;
  const eyebrow = step === 0 ? "Teammate" : step === 1 ? "Wallet" : "Invite";
  const title =
    step === 0 ? "Add a Teammate" : step === 1 ? "Signer permissions" : "Invite is ready";
  const description = step === 0 ? "" : step === 1 ? "" : "Share this link with the signer.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-black text-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
        <div className="flex gap-2 px-8 pt-6">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full bg-white transition-all duration-300 ${
                  step >= index ? "w-full" : "w-0"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="flex items-start justify-between gap-5 px-8 py-7">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-white/45">
              {eyebrow}
            </p>
            <h2 className="mt-4 text-[34px] font-semibold tracking-[-0.04em]">{title}</h2>
            <p className="mt-3 max-w-md text-[14px] leading-6 text-white/55">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[20px] text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close add signer modal"
          >
            ×
          </button>
        </div>

        <div className="border-t border-white/15 px-8 py-7">
          {step === 0 ? (
            <div className="space-y-4">
              <TextField label="Name" value={signerName} onChange={onNameChange} placeholder="" />
              <TextField
                label="Designation"
                value={signerDesignation}
                onChange={onDesignationChange}
                placeholder=""
              />
              <TextField
                label="Email"
                value={signerEmail}
                onChange={onEmailChange}
                placeholder=""
                type="email"
              />
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <div className="flex items-center justify-between gap-4 text-[13px]">
                  <span className="text-white/45">Current threshold</span>
                  <span className="font-mono">
                    {settingsAccount?.threshold ?? 0} of {settingsAccount?.signers?.length ?? 0}
                  </span>
                </div>
              </div>
              <TextField
                label="Signer public key"
                value={signerAddress}
                onChange={onAddressChange}
                placeholder="Signer wallet address"
              />
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-white">
                  Signer can
                </span>
                <select
                  value={signerPermissions}
                  onChange={(event) => onPermissionsChange(event.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] text-black outline-none transition-colors focus:border-neutral-400"
                >
                  <option value="7">Initiate, approve, and execute payments</option>
                  <option value="1">Initiate payments</option>
                  <option value="2">Approve payments</option>
                  <option value="4">Execute approved payments</option>
                </select>
                <div className="mt-2">
                  <PermissionChips mask={Number(signerPermissions)} align="start" />
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <p className="text-[12.5px] text-white/45">Invite link</p>
                <div className="mt-3 flex items-center gap-3">
                  <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/85">
                    {inviteUrl}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onCopy(inviteUrl)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-opacity hover:opacity-90"
                    aria-label="Copy invite link"
                  >
                    {copied === inviteUrl ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/4 p-4 text-[13px] leading-6 text-white/55">
                The signer must connect{" "}
                <span className="font-mono text-white/85">
                  {shortAddress(signerAddress || settingsAccount?.pda || "")}
                </span>{" "}
                on the invite page. If they connect another wallet, the invite stays locked.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-8 pb-8">
          <button
            type="button"
            onClick={step === 0 || step === 2 ? onClose : () => onStepChange(0)}
            className="h-12 flex-1 rounded-full border border-white/15 text-[14px] font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {step === 0 ? "Cancel" : step === 2 ? "Done" : "Back"}
          </button>
          {step === 0 ? (
            <button
              type="button"
              onClick={() => onStepChange(1)}
              disabled={!canContinue}
              className="h-12 flex-[1.6] rounded-full bg-white text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Continue
            </button>
          ) : step === 1 ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !canSubmit}
              className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" size={15} />
              ) : (
                <UserPlus size={15} />
              )}
              {isSubmitting ? "Signing" : "Add signer"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onCopy(inviteUrl)}
              className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-black transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {copied === inviteUrl ? <Check size={15} /> : <Copy size={15} />}
              {copied === inviteUrl ? "Copied" : "Copy invite"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTransactionModal({
  acting,
  smartAccounts,
  selectedSmartAccountId,
  amountSol,
  recipient,
  memo,
  onSmartAccountChange,
  onAmountChange,
  onRecipientChange,
  onMemoChange,
  onClose,
  onSubmit,
}: {
  acting: string;
  smartAccounts: SmartAccount[];
  selectedSmartAccountId: string;
  amountSol: string;
  recipient: string;
  memo: string;
  onSmartAccountChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onRecipientChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isSubmitting = acting === "payment";
  const canSubmit = Boolean(
    selectedSmartAccountId && amountSol.trim() && recipient.trim() && !isSubmitting,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8 backdrop-blur-md">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-black text-white shadow-[0_30px_100px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-start justify-between gap-5 px-8 py-7">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.24em] text-white/45">
              Payment
            </p>
            <h2 className="mt-4 text-[34px] font-semibold tracking-[-0.04em]">
              Create transaction
            </h2>
            <p className="mt-3 max-w-md text-[14px] leading-6 text-white/55">
              Prepare a SOL transfer from one smart account. Phantom signs the create transaction
              and proposal.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-[20px] text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close create transaction modal"
          >
            ×
          </button>
        </div>

        <div className="border-t border-white/15 px-8 py-7">
          {smartAccounts.length ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
                <label className="block">
                  <span className="mb-2 block text-[13px] font-medium text-white/70">
                    Source account
                  </span>
                  <select
                    value={selectedSmartAccountId}
                    onChange={(event) => onSmartAccountChange(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-white px-4 text-[14px] font-medium text-black outline-none transition-colors focus:border-white"
                  >
                    {smartAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} / index {account.accountIndex}
                      </option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Amount SOL"
                  value={amountSol}
                  onChange={onAmountChange}
                  placeholder="1.25"
                  type="number"
                />
              </div>
              <TextField
                label="Recipient"
                value={recipient}
                onChange={onRecipientChange}
                placeholder="Recipient public key"
              />
              <TextField
                label="Memo"
                value={memo}
                onChange={onMemoChange}
                placeholder="August vendor payout"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/4 p-5 text-[14px] leading-6 text-white/60">
              Create a smart account first, then return here to prepare a transfer.
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-8 pb-8">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-12 flex-1 rounded-full border border-white/15 text-[14px] font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
            {isSubmitting ? "Signing" : "Create transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ReceiptPreviewModal({
  receipt,
  walletAddress,
  onClose,
}: {
  receipt: ReceiptRecord;
  walletAddress: string;
  onClose: () => void;
}) {
  const filePath = receipt.fileUrl.startsWith("/receipts/")
    ? receipt.fileUrl
    : `/receipts/${receipt.id}/file`;
  const fileSrc = `${API_BASE}${filePath}?walletAddress=${encodeURIComponent(walletAddress)}`;
  const isPdf = receipt.fileMimeType === "application/pdf";
  const isImage = receipt.fileMimeType?.startsWith("image/");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-md">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_28px_100px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-neutral-950">
              {receipt.vendor || receipt.fileName || "Receipt"}
            </p>
            <p className="mt-0.5 text-[12px] text-neutral-400">{humanStatus(receipt.status)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-full px-3 text-[13px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-950"
          >
            Close
          </button>
        </div>
        <div className="relative h-[72vh] bg-neutral-100">
          {isPdf || !isImage ? (
            <iframe title="Receipt preview" src={fileSrc} className="h-full w-full border-0" />
          ) : (
            <Image
              src={fileSrc}
              alt="Receipt preview"
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              unoptimized
              className="object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export { AddSignerModal, CreateTransactionModal, ReceiptPreviewModal };
