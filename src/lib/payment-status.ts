// Rider payment status, derived from what Entry Ninja gives us.
// Entry Ninja's API only exposes a paid true/false flag, so amounts are optional
// and come from the roster import (amount due / amount paid) when available.
export type PaymentInfo = {
  paid: boolean | null;
  amount_due_cents?: number | null;
  amount_paid_cents?: number | null;
};

export type PaymentStatus = {
  state: "paid" | "outstanding" | "unknown";
  label: string;
  detail: string | null;
  balanceCents: number | null;
};

export function formatRands(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function paymentStatus(info: PaymentInfo | null | undefined): PaymentStatus | null {
  if (!info) return null;
  const due = info.amount_due_cents ?? null;
  const paidAmt = info.amount_paid_cents ?? null;

  if (due != null) {
    const balance = due - (paidAmt ?? 0);
    if (balance <= 0) {
      return {
        state: "paid",
        label: "Fully paid",
        detail: `${formatRands(due)} received — nothing outstanding.`,
        balanceCents: 0,
      };
    }
    return {
      state: "outstanding",
      label: `Balance outstanding: ${formatRands(balance)}`,
      detail:
        paidAmt != null && paidAmt > 0
          ? `${formatRands(paidAmt)} paid of ${formatRands(due)}.`
          : `Entry total ${formatRands(due)}.`,
      balanceCents: balance,
    };
  }

  if (info.paid === true) {
    return {
      state: "paid",
      label: "Fully paid",
      detail: "Entry Ninja has your entry marked as paid in full.",
      balanceCents: 0,
    };
  }
  if (info.paid === false) {
    return {
      state: "outstanding",
      label: "Balance outstanding",
      detail: "Entry Ninja shows your entry as unpaid. Settle it to confirm your spot.",
      balanceCents: null,
    };
  }
  return {
    state: "unknown",
    label: "Payment status pending",
    detail: "We haven't received a payment confirmation from Entry Ninja yet.",
    balanceCents: null,
  };
}
