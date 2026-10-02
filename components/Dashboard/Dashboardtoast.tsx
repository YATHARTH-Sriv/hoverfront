import { Shield, X } from "lucide-react";

export function DashboardToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed right-5 top-5 z-70 max-h-[min(320px,calc(100vh-2.5rem))] w-[min(calc(100vw-2rem),420px)] overflow-auto rounded-[18px] border border-red-200 bg-white p-3.5 text-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Shield size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Needs attention</p>
          <p className="mt-1 break-words text-[13px] leading-5 text-neutral-600">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          aria-label="Dismiss notification"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
