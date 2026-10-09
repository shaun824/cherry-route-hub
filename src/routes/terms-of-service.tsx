import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

const TITLE = "Terms of Service — Red Cherry Events Rider Hub";
const DESC = "The terms for using the Red Cherry Events Rider Hub app and website.";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="By using the Red Cherry Events Rider Hub you agree to these terms. If you don't agree, please don't use the app."
    >
      <LegalSection title="What the Rider Hub is">
        <p>The Rider Hub is a companion app for Red Cherry Events riders, crew and partners. It shows event information, routes, schedules, results, live tracking, sponsor offers and rewards. Event entries are made and paid for on Entry Ninja, under the event's own entry terms and indemnity.</p>
      </LegalSection>
      <LegalSection title="Your account">
        <p>Keep your sign-in details private and give accurate information. You are responsible for activity on your account. We may suspend accounts that are misused.</p>
      </LegalSection>
      <LegalSection title="Event information">
        <p>We work hard to keep schedules, routes, weather and other details accurate, but they can change. Official briefings and instructions from event officials on the day always take priority over the app.</p>
      </LegalSection>
      <LegalSection title="Safety features">
        <p>Live tracking and SOS are there to help, but they depend on your phone, battery and mobile signal and may not always work. They do not replace the event's safety rules, marshals or medical teams. Always ride responsibly and follow official instructions.</p>
      </LegalSection>
      <LegalSection title="Sponsor offers and rewards">
        <p>Sponsor offers are provided by the sponsor and subject to their conditions. Rewards and points have no cash value and may change.</p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <p>Don't misuse the app: no false SOS alerts, no attempts to access other people's information, and no interfering with how it works.</p>
      </LegalSection>
      <LegalSection title="Liability">
        <p>The app is provided as is. To the extent the law allows, Red Cherry Events is not liable for losses arising from using or being unable to use the app. Taking part in events is covered by each event's own indemnity.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>We may update these terms from time to time. The date at the top shows the latest version.</p>
      </LegalSection>
    </LegalPage>
  );
}
