import { ActivityLog, SettingsSigner } from "@/types";
import { avatarColor, initials, PermissionChips, shortAddress } from "./helpers";

function SignerList({ signers }: { signers: SettingsSigner[] }) {
  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-100">
      {signers.length ? (
        signers.map((signer) => {
          const color = avatarColor(signer.walletAddress);
          const displayName = signer.name ?? signer.label ?? signer.role.toLowerCase();
          const subtitle = [signer.designation, signer.email].filter(Boolean).join(" · ");
          return (
            <div
              key={signer.id}
              className="grid grid-cols-[2.2fr_3fr_1.4fr] items-center px-3 py-3 transition-colors hover:bg-neutral-50"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: color.bg, color: color.fg }}
                >
                  {initials(displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-neutral-900">{displayName}</p>
                  <p className="truncate text-[12px] text-neutral-400">
                    {subtitle || signer.role.toLowerCase()}
                  </p>
                </div>
              </div>
              <span className="truncate font-mono text-[12.5px] text-neutral-500">
                {signer.walletAddress}
              </span>
              <PermissionChips mask={signer.permissionsMask} />
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center text-[13px] text-neutral-400">No signers indexed yet.</div>
      )}
    </div>
  );
}

function ActivityList({ activities }: { activities: ActivityLog[] }) {
  return (
    <div className="mt-4 divide-y divide-neutral-100 rounded-xl bg-black text-white border border-neutral-100">
      {activities.length ? (
        activities.map((activity) => {
          const label = activity.title ?? activity.type ?? activity.action ?? "Activity";
          const color = avatarColor(activity.id);
          return (
            <div
              key={activity.id}
              className="flex items-center gap-3.5 px-4 py-3.5 transition-colors "
            >
              <div
                className="flex size-8 shrink-0 items-center text-white justify-center rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: color.bg, color: color.fg }}
              >
                {initials(label)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium capitalize text-white">
                  {label.replaceAll("_", " ").toLowerCase()}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-white">
                  {activity.description ?? activity.message ?? activity.status ?? "Completed"}
                </p>
              </div>
              <p className="shrink-0 text-[12.5px] text-white">
                {new Date(activity.createdAt).toLocaleString()}
              </p>
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center text-[13px] text-neutral-400">No activity yet.</div>
      )}
    </div>
  );
}

export { SignerList, ActivityList };
