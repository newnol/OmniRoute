"use client";

import { useTranslations } from "next-intl";
import { calculatePercentage, formatQuotaLabel, getBarColor, topQuotas } from "../utils";
import QuotaMiniBar from "../QuotaMiniBar";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  KRW: "₩",
  INR: "₹",
};

interface Props {
  quotas: any[];
  /** When > MAX_VISIBLE, render "+N more" hint. */
  maxVisible?: number;
  loading: boolean;
  error: string | null;
  message: string | null;
}

const MAX_VISIBLE_DEFAULT = 3;

function formatCurrencyAmount(value: number, currency?: string) {
  if (!currency || !CURRENCY_SYMBOLS[currency])
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${CURRENCY_SYMBOLS[currency]}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function QuotaRow({ q }: { q: any }) {
  const pctRaw = q.unlimited
    ? 100
    : (q.remainingPercentage ?? calculatePercentage(q.used, q.total));
  const pct = Math.round(pctRaw);
  const colors = getBarColor(pct);
  const label = q.displayName || formatQuotaLabel(q.name);
  const usedNum = Number(q.used || 0);
  const totalNum = Number(q.total || 0);
  const remainingNum = Number(q.remaining ?? (totalNum > 0 ? totalNum - usedNum : 0));
  const hasCurrency = !!q.currency;
  const isRemainingRow = /remaining/i.test(label) && q.remaining !== undefined;
  const showUsage = totalNum > 0 || (q.unlimited && usedNum > 0) || hasCurrency;

  return (
    <div className="flex flex-col gap-0.5 py-0.5" title={q.modelKey || q.name}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-text-main truncate flex-1 min-w-0">{label}</span>
        <span
          className="text-[11px] font-bold tabular-nums shrink-0"
          style={{ color: colors.text }}
        >
          {q.unlimited ? "∞" : `${pct}%`}
        </span>
      </div>
      {!q.unlimited && <QuotaMiniBar percent={pct} />}
      {showUsage && (
        <div className="text-[10px] text-text-muted tabular-nums">
          {hasCurrency
            ? `${formatCurrencyAmount(isRemainingRow ? remainingNum : usedNum, q.currency)} / ${q.unlimited ? "∞" : formatCurrencyAmount(totalNum, q.currency)}`
            : `${(isRemainingRow ? remainingNum : usedNum).toLocaleString()} / ${q.unlimited ? "∞" : totalNum.toLocaleString()}`}
        </div>
      )}
    </div>
  );
}

export default function QuotaCardBody({
  quotas,
  maxVisible = MAX_VISIBLE_DEFAULT,
  loading,
  error,
  message,
}: Props) {
  const t = useTranslations("usage");

  if (loading) {
    return (
      <div className="px-3 py-3 text-[11px] text-text-muted flex items-center gap-1.5">
        <span className="material-symbols-outlined animate-spin text-[13px]">
          progress_activity
        </span>
        {t("loadingQuotas")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3 text-[11px] text-red-500 flex items-start gap-1.5">
        <span className="material-symbols-outlined text-[13px] mt-0.5">error</span>
        <span className="truncate">{error}</span>
      </div>
    );
  }

  if ((!quotas || quotas.length === 0) && message) {
    return (
      <div className="px-3 py-3 text-[11px] text-text-muted italic truncate" title={message}>
        {message}
      </div>
    );
  }

  if (!quotas || quotas.length === 0) {
    return <div className="px-3 py-3 text-[11px] text-text-muted italic">{t("noQuotaData")}</div>;
  }

  const visible = topQuotas(quotas, maxVisible);
  const hidden = Math.max(0, quotas.length - visible.length);

  return (
    <div className="flex flex-col gap-1 px-3 pb-2">
      {visible.map((q, i) => (
        <QuotaRow key={`${q.name}-${q.modelKey ?? ""}-${i}`} q={q} />
      ))}
      {hidden > 0 && (
        <div className="text-[10px] text-text-muted italic pt-0.5">+{hidden} more</div>
      )}
    </div>
  );
}
