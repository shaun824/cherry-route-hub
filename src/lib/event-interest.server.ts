// Server-side helpers for event interest sign-ups: Everlytic list sync and
// the upsert used by the public endpoint. Never throws past the caller in a
// way that would block a sign-up response — Everlytic failures are logged and
// the row stays everlytic_synced=false for admin reconciliation.
import { everlyticRequest } from "./everlytic.server";
import { mayAddMembership } from "./entry-interest-audience";

/** Adds the email to one Everlytic list, preserving opt-outs and existing memberships. */
export async function syncEventInterestToList(
  email: string,
  listId: string,
  username: string,
  apiKey: string,
  name?: string | null,
) {
  async function lookup() {
    const raw = await everlyticRequest(
      `/api/2.0/contacts?filters[email]=${encodeURIComponent(email)}&count=25`,
      "GET",
      username,
      apiKey,
    );
    return (raw.collection ?? [])
      .map((item: { data?: Record<string, unknown> }) => item.data ?? item)
      .find((c: Record<string, unknown>) => String(c.email).toLowerCase() === email);
  }
  let contact = await lookup();
  if (!contact) {
    await everlyticRequest("/api/2.0/contacts", "POST", username, apiKey, {
      contact_email: email,
      list_id: listId,
      ...(name ? { contact_name: name } : {}),
    });
    contact = await lookup();
  }
  if (!contact?.id) throw new Error("Could not verify mailing-list contact");
  let mapping = null;
  try {
    mapping = await everlyticRequest(`/api/2.0/list_subscriptions/${listId}/${contact.id}`, "GET", username, apiKey);
  } catch (error) {
    if (!(error && typeof error === "object" && "status" in error && error.status === 404)) throw error;
  }
  if (mayAddMembership(contact, mapping)) {
    await everlyticRequest(`/api/2.0/list_subscriptions/${listId}`, "POST", username, apiKey, {
      contact_id: contact.id,
      email_status: "subscribed",
    });
  }
  return { verified: true };
}
