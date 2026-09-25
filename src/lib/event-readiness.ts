// Standard operational questions every event needs answered so the assistant
// can brief crew. Shared by the admin readiness panel and its server functions.
export type ReadinessQuestion = { id: string; section: string; question: string };

export const READINESS_SECTIONS: { section: string; questions: [string, string][] }[] = [
  {
    section: "Safety & medical",
    questions: [
      ["safety-officer", "Who is the safety officer and who is the on-site medic?"],
      ["emergency-numbers", "What are the emergency numbers crew should call?"],
      ["hospital", "Where is the nearest hospital and what is the route there?"],
    ],
  },
  {
    section: "Build day & setup",
    questions: [
      ["call-times", "What are the crew call times for build day?"],
      ["build-priorities", "What gets built first, and in what order?"],
      ["setup-leads", "Who leads each setup crew or area?"],
    ],
  },
  {
    section: "Power & utilities",
    questions: [
      ["generators", "Where do the generators go and who handles refuelling?"],
      ["water", "Where are the water refill points or tanker spots?"],
    ],
  },
  {
    section: "Fleet & transport",
    questions: [
      ["drivers", "Who is driving which vehicle, truck or trailer?"],
      ["departures", "When do the trucks leave and when do they arrive on site?"],
    ],
  },
  {
    section: "Access & parking",
    questions: [
      ["gate-access", "What are the gate access rules for crew, riders and public?"],
      ["crew-parking", "Where do crew park versus riders?"],
      ["deliveries", "How and when do vendor and supplier deliveries come in?"],
    ],
  },
  {
    section: "Contingencies",
    questions: [
      ["weather-plan", "What is the plan if wind or rain turns bad?"],
      ["course-shortening", "What triggers shortening or stopping the course?"],
      ["evacuation-point", "Where is the evacuation meeting point?"],
    ],
  },
  {
    section: "Site facilities",
    questions: [
      ["crew-catering", "Where and when is crew catering?"],
      ["storage-keys", "Who holds the storage container keys?"],
      ["toilets", "Where are the toilets and who services them?"],
    ],
  },
];

export const READINESS_QUESTIONS: ReadinessQuestion[] = READINESS_SECTIONS.flatMap((s) =>
  s.questions.map(([id, question]) => ({ id, section: s.section, question })),
);

export const readinessRef = (id: string) => `readiness:${id}`;
