export interface EverlyticCampaign {
  id: string;
  subject: string;
  status: string;
  sent: number;
  hasAudience: boolean;
}

export function campaignCanSend(campaign: EverlyticCampaign) {
  return campaign.status === "composing" && campaign.hasAudience;
}

export function readEverlyticCampaigns(payload: unknown): EverlyticCampaign[] {
  const collection = (payload as { collection?: unknown })?.collection;
  if (!Array.isArray(collection)) throw new Error("Unexpected Everlytic response");
  return collection.flatMap((item) => {
    const row = item?.data;
    if (!row || !/^\d+$/.test(String(row.id))) return [];
    return [{ id: String(row.id), subject: String(row.subject || "Untitled email"),
      status: String(row.status || "unknown"), sent: Number(row.total_actual_sent || 0),
      hasAudience: Array.isArray(row.list_ids) ? row.list_ids.length > 0 : Boolean(row.list_ids) }];
  });
}