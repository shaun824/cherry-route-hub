import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Send, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { manageEverlytic } from "@/lib/everlytic.functions";
import { campaignCanSend } from "@/lib/everlytic-data";

export function EverlyticPanel() {
  const manage = useServerFn(manageEverlytic);
  const [selected, setSelected] = useState("");
  const q = useQuery({ queryKey: ["everlytic-campaigns"], queryFn: () => manage({ data: { action: "list" } }), retry: false });
  const action = useMutation({ mutationFn: (type: "preview" | "send") => manage({ data: { action: type, campaignId: selected } }),
    onSuccess: (result) => { toast.success(result.message); void q.refetch(); }, onError: (error: Error) => toast.error(error.message) });
  const campaign = q.data?.campaigns.find(c => c.id === selected);
  return <section className="space-y-3 border-b border-border pb-6" aria-label="Everlytic emails">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Mail className="size-4" /> Everlytic</h2>
      <Button variant="ghost" size="icon" title="Refresh Everlytic campaigns" aria-label="Refresh Everlytic campaigns" onClick={() => void q.refetch()}><RefreshCw /></Button></div>
    <p className="text-sm text-ink-soft">{q.isPending ? "Checking connection…" : q.error ? q.error.message : "Connected · latest 20 campaigns"}</p>
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label="Everlytic campaign" className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Choose Everlytic campaign…</option>{q.data?.campaigns.map(c => <option key={c.id} value={c.id}>{c.subject} · {c.status}</option>)}
      </select>
      <Button variant="outline" disabled={!campaign || action.isPending} onClick={() => action.mutate("preview")}><Mail /> Preview to Shaun</Button>
      <Button disabled={!campaign || !campaignCanSend(campaign) || action.isPending} onClick={() => { if (campaign && window.confirm(`Send “${campaign.subject}” to its subscribed Everlytic audience?`)) action.mutate("send"); }}><Send /> Send campaign</Button>
    </div>
    {campaign ? <p className="text-sm text-ink-soft">{campaign.status} · {campaign.sent} sent</p> : null}
  </section>;
}