// "Chat on WhatsApp" deep-link button. Renders nothing until an admin has
// enabled WhatsApp support and saved a number in Admin → Site settings.
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { fetchSupportSettings, waLink } from "@/lib/whatsapp";

export function WhatsappButton({
  context,
  className,
  size = "md",
}: {
  /** Extra context prefilled into the message, e.g. the event name. */
  context?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const q = useQuery({
    queryKey: ["support-settings"],
    queryFn: fetchSupportSettings,
    staleTime: 10 * 60 * 1000,
  });

  const s = q.data;
  if (!s?.whatsappEnabled || !s.whatsappNumber) return null;

  const message = context
    ? `Hi Red Cherry Events — I have a question about ${context}.`
    : "Hi Red Cherry Events — I have a question.";

  return (
    <a
      href={waLink(s.whatsappNumber, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#25D366] font-semibold text-white ${
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      } ${className ?? ""}`}
    >
      <MessageCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {s.whatsappLabel || "Chat on WhatsApp"}
    </a>
  );
}
