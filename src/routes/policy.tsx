import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/legal-page";

const TITLE = "Privacy Policy — Red Cherry Events Rider Hub";
const DESC = "How the Red Cherry Events Rider Hub collects, uses and protects rider information.";

export const Route = createFileRoute("/policy")({
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
  component: PolicyPage,
});

function PolicyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This policy explains what information the Red Cherry Events Rider Hub collects when you use it, why we use it, and the choices you have."
    >
      <LegalSection title="Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account details</strong> — your name and email address when you sign in, including when you sign in with Google.</li>
          <li><strong>Entry details</strong> — your event entries, category, start information and apparel sizes, synced from Entry Ninja where you entered.</li>
          <li><strong>ID number</strong> — used only to find and link your entries. We do not keep your full ID number or date of birth; we store a scrambled version and a broad age group.</li>
          <li><strong>Location</strong> — only when you choose to turn on live tracking or send an SOS during an event.</li>
          <li><strong>Usage information</strong> — which pages and features are used, so we can improve the app. This does not include personal details.</li>
        </ul>
      </LegalSection>
      <LegalSection title="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To show your events, schedules, routes, results and rewards.</li>
          <li>To send event emails and notifications you need for race day.</li>
          <li>For rider safety — so race control and medics can find you if you send an SOS or are being tracked.</li>
          <li>To produce anonymous event statistics, such as entry counts and age groups. These never include names, emails, phone numbers or ID numbers.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Sharing">
        <p>We do not sell your information. We share it only with services we use to run our events (such as Entry Ninja for entries and timing partners for results), or when the law requires it. Sponsor offers in the app link to sponsors, but we do not pass your details to them.</p>
      </LegalSection>
      <LegalSection title="Google sign-in">
        <p>If you sign in with Google, we receive only your name, email address and profile picture, and use them only to create and identify your Rider Hub account.</p>
      </LegalSection>
      <LegalSection title="Your choices">
        <p>You can turn off location sharing and notifications at any time, and you can ask us to see, correct or delete your information by emailing us.</p>
      </LegalSection>
    </LegalPage>
  );
}
