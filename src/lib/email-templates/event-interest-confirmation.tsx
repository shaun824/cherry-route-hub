import * as React from "react";
import { Button, Heading, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { EmailShell, button, h1, text } from "./theme";

interface Props {
  firstName?: string | null;
  eventName?: string;
  eventUrl?: string;
}

const Email = ({ firstName, eventName = "your event", eventUrl = "https://riderhub.redcherryevents.co.za/events" }: Props) => (
  <EmailShell preview={`You are on the list for ${eventName} updates.`} siteName="Red Cherry Events">
    <Heading style={h1}>{firstName ? `Thanks, ${firstName}. You are on the list.` : "Thanks. You are on the list."}</Heading>
    <Text style={text}>
      We will email you when dates and entries for <strong>{eventName}</strong> are confirmed. This is an entry alert, not a booked entry.
    </Text>
    <Text style={text}>You can open the event page any time for the latest venue, schedule and entry information.</Text>
    <Button style={button} href={eventUrl}>Open the event page</Button>
  </EmailShell>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) => `You are on the list: ${String(data.eventName ?? "event updates")}`,
  displayName: "Event interest sign-up confirmation",
  previewData: { firstName: "Shaun", eventName: "JBFE Sea to Sea North 2027", eventUrl: "https://riderhub.redcherryevents.co.za/my-events/jbfe-sea-to-sea-north-2027" },
} satisfies TemplateEntry;
