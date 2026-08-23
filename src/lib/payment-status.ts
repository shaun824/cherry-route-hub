// Rider payment status, derived from what Entry Ninja gives us.
// Entry Ninja's API only exposes a paid true/false flag, so amounts are optional
// and come from the roster import (amount due / amount paid) when available.
export type PaymentInfo = {
  paid: boolean | null;
  amount_due_cents?: number | null;
  amount_paid_cents?: number | null;
  /** Entry value worked out from the event price book, when no imported amount exists. */
  priced_total_cents?: number | null;
  /** True when the price book covered every line of the entry. */
  priced_complete?: boolean;
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

  // No imported amount — fall back to the event price book.
  const priced = info.priced_total_cents ?? null;
  if (priced != null && priced > 0) {
    if (info.paid === true) {
      return {
        state: "paid",
        label: "Fully paid",
        detail: `Entry total ${formatRands(priced)} — nothing outstanding.`,
        balanceCents: 0,
      };
    }
    if (info.paid === false) {
      const approx = info.priced_complete ? "" : " (at least — some extras aren't priced yet)";
      return {
        state: "outstanding",
        label: `Balance outstanding: ${formatRands(priced)}`,
        detail: `Your entry and extras come to ${formatRands(priced)}${approx}. Settle it on Entry Ninja to confirm your spot.`,
        balanceCents: priced,
      };
    }
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
