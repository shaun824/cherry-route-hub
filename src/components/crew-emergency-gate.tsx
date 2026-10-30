// Every crew member must have emergency details on file before using the crew
// area: first name, cell, date of birth and medical aid. Stored in a table only
// the person and admins can read.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { checkIsCrew } from "@/lib/crew";

type Form = {
  first_name: string;
  cell_number: string;
  date_of_birth: string;
  medical_aid_name: string;
  medical_aid_number: string;
  medical_aid_plan: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  medical_notes: string;
};

const empty: Form = {
  first_name: "",
  cell_number: "",
  date_of_birth: "",
  medical_aid_name: "",
  medical_aid_number: "",
  medical_aid_plan: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  medical_notes: "",
};

export function CrewEmergencyGate({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["crew-emergency-profile", userId],
    queryFn: async () => {
      if (!(await checkIsCrew(supabase as never))) return { crew: false, row: null };
      const [{ data: row }, { data: prof }] = await Promise.all([
        supabase.from("crew_emergency_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("full_name, phone, emergency_contact_name, emergency_contact_phone").eq("id", userId).maybeSingle(),
      ]);
      return { crew: true, row, prof };
    },
  });
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = q.data && "prof" in q.data ? q.data.prof : null;
    if (p && !q.data?.row) {
      setForm((f) => ({
        ...f,
        first_name: f.first_name || (p.full_name ?? "").split(" ")[0] || "",
        cell_number: f.cell_number || p.phone || "",
        emergency_contact_name: f.emergency_contact_name || p.emergency_contact_name || "",
        emergency_contact_phone: f.emergency_contact_phone || p.emergency_contact_phone || "",
      }));
    }
  }, [q.data]);

  if (!q.data || !q.data.crew || q.data.row) return null;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const ready =
    form.first_name.trim() && form.cell_number.trim().length >= 9 && form.date_of_birth && form.medical_aid_name.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])) as Record<string, string | null>;
    const { error } = await supabase.from("crew_emergency_profiles").insert({
      user_id: userId,
      first_name: clean.first_name!,
      cell_number: clean.cell_number!,
      date_of_birth: clean.date_of_birth!,
      medical_aid_name: clean.medical_aid_name!,
      medical_aid_number: clean.medical_aid_number,
      medical_aid_plan: clean.medical_aid_plan,
      emergency_contact_name: clean.emergency_contact_name,
      emergency_contact_phone: clean.emergency_contact_phone,
      medical_notes: clean.medical_notes,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save your details. Please try again.");
      return;
    }
    toast.success("Thanks, your emergency details are on file.");
    void qc.invalidateQueries({ queryKey: ["crew-emergency-profile", userId] });
  }

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background/95 p-4">
      <form onSubmit={save} className="mx-auto max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Your emergency details</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          All crew need these on file before working an event, so medics and race control can help you quickly if something happens. Only you and Red Cherry admins can see them.
        </p>
        <label className="block text-sm font-medium">First name *<input className={input} value={form.first_name} onChange={set("first_name")} required /></label>
        <label className="block text-sm font-medium">Cell number *<input className={input} type="tel" value={form.cell_number} onChange={set("cell_number")} required /></label>
        <label className="block text-sm font-medium">Date of birth *<input className={input} type="date" value={form.date_of_birth} onChange={set("date_of_birth")} required /></label>
        <label className="block text-sm font-medium">Medical aid *<input className={input} placeholder="e.g. Discovery, or None" value={form.medical_aid_name} onChange={set("medical_aid_name")} required /></label>
        <label className="block text-sm font-medium">Medical aid plan<input className={input} value={form.medical_aid_plan} onChange={set("medical_aid_plan")} /></label>
        <label className="block text-sm font-medium">Membership number<input className={input} value={form.medical_aid_number} onChange={set("medical_aid_number")} /></label>
        <label className="block text-sm font-medium">Emergency contact name<input className={input} value={form.emergency_contact_name} onChange={set("emergency_contact_name")} /></label>
        <label className="block text-sm font-medium">Emergency contact number<input className={input} type="tel" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} /></label>
        <label className="block text-sm font-medium">Allergies or medical conditions<textarea className={input} rows={2} value={form.medical_notes} onChange={set("medical_notes")} /></label>
        <button type="submit" disabled={!ready || saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save and continue
        </button>
      </form>
    </div>
  );
}
