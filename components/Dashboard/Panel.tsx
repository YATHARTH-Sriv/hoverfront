import { ReactNode } from "react";

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-100 bg-black text-white">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-5">
        <div>
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
          <p className="mt-0.5 max-w-xl text-[13px] leading-5 text-white">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-5 text-black">{children}</div>
    </section>
  );
}

function SummaryPanel({
  title,
  description,
  count,
  children,
  onMore,
}: {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
  onMore: () => void;
}) {
  return (
    <Panel
      title={title}
      description={description}
      action={
        <button
          type="button"
          onClick={onMore}
          className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-black transition-opacity hover:opacity-85"
        >
          More {count ? `(${count})` : ""}
        </button>
      }
    >
      {children}
    </Panel>
  );
}

export { Panel, SummaryPanel };
