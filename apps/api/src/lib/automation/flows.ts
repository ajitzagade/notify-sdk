// Fixed, platform-wide automation flows — v1 scope deliberately: one flow,
// same for every tenant, no per-client editor yet (that's a real follow-up,
// not this file's job). See dispatchAutomationFlow.ts for the state machine
// that walks a contact through these steps.

export interface FlowStep {
  question: string;
  /** Up to 3 labels — sent as WhatsApp quick-reply buttons. Omit for free text. */
  options?: string[];
}

export interface FlowDefinition {
  key: string;
  /** Case-insensitive keyword a customer texts to start this flow. Must not
   * collide with STOP/START/SUBSCRIBE/UNSUBSCRIBE — those are opt-in/out,
   * handled before any flow or AI logic ever sees the message. */
  triggerKeyword: string;
  steps: FlowStep[];
  completionMessage: string;
}

export const APPOINTMENT_INTAKE_FLOW: FlowDefinition = {
  key: 'appointment_intake',
  triggerKeyword: 'book',
  steps: [
    { question: 'What brings you in today?', options: ['Booking', 'Billing', 'Other'] },
    { question: 'What date works best for you?' },
    { question: 'Morning or afternoon?', options: ['Morning', 'Afternoon'] },
    { question: 'Best number to reach you if we need to confirm?' },
    { question: 'Anything else we should know before your visit?' },
  ],
  completionMessage: "Thanks — that's everything we need! Our team will confirm your appointment shortly.",
};

/** The single active flow. Becomes a lookup by key once more than one exists. */
export const ACTIVE_FLOW = APPOINTMENT_INTAKE_FLOW;
