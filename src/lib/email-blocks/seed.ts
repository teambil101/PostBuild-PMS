import type { EmailBlock, EmailCategory } from "./types";

export type EmailCategory = "alert" | "quote" | "notice" | "service_request" | "work_update" | "confirmation";

export interface SeedTemplate {
  template_key: string;
  category: EmailCategory;
  name: string;
  description: string;
  subject: string;
  preheader: string;
  blocks: EmailBlock[];
  available_variables: string[];
}

const id = (() => {
  let i = 0;
  return () => `b${++i}`;
})();

const HEADER: EmailBlock = { id: id(), type: "header", showLogo: true, showCompanyName: true, align: "left" };
const DIVIDER: EmailBlock = { id: id(), type: "divider" };
const SPACER_SM: EmailBlock = { id: id(), type: "spacer", heightPx: 12 };
const FOOTER: EmailBlock = {
  id: id(),
  type: "footer",
  showSocial: true,
  showAddress: true,
  showUnsubscribe: true,
  customText: "You're receiving this because you have an active relationship with {{company_name}}.",
};

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

export const SEED_TEMPLATES: SeedTemplate[] = [
  // ─────────── ALERTS ───────────
  {
    template_key: "alert.rent_overdue",
    category: "alert",
    name: "Rent Overdue — Landlord Alert",
    description: "Sent to the landlord when a tenant invoice passes its due date.",
    subject: "Rent overdue — {{unit_label}} ({{days_past_due}} days)",
    preheader: "{{tenant_name}} has not paid rent of {{amount_due}} due on {{due_date}}.",
    available_variables: ["landlord_name", "tenant_name", "unit_label", "amount_due", "due_date", "days_past_due", "invoice_number", "services_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Action required", headline: "Rent payment is overdue", subheadline: "We wanted to let you know about an unpaid rent invoice for one of your units.", align: "left", emphasis: "warning" },
      { id: id(), type: "text", content: "Dear {{landlord_name}},\n\n**{{tenant_name}}** has not yet paid the rent for **{{unit_label}}**. The invoice is now **{{days_past_due}} days past due**.", align: "left" },
      { id: id(), type: "table", title: "Invoice details", rows: [
        { label: "Tenant", value: "{{tenant_name}}" },
        { label: "Unit", value: "{{unit_label}}" },
        { label: "Invoice", value: "{{invoice_number}}" },
        { label: "Amount due", value: "{{amount_due}}" },
        { label: "Due date", value: "{{due_date}}" },
        { label: "Days past due", value: "{{days_past_due}}" },
      ] },
      { id: id(), type: "callout", tone: "warning", title: "Recommended next steps",
        body: "1. Send a friendly reminder via WhatsApp or email.\n2. If unpaid by day 7, issue a formal demand letter (Notice 25 — UAE Law 26/2007).\n3. After 30 days, consider filing with the Rental Dispute Centre (RDC)." },
      { id: id(), type: "button", label: "Browse Legal Services", href: "{{services_url}}", align: "center", variant: "primary" },
      { id: id(), type: "text", content: "Post Build can connect you with vetted legal partners for demand letters, RDC filings, and eviction notices — all on the marketplace.", align: "left" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "alert.lease_expiring",
    category: "alert",
    name: "Lease Expiring — 90-day Notice",
    description: "Sent to the landlord 90 days before lease expiry.",
    subject: "Lease expiring soon — {{unit_label}}",
    preheader: "Lease for {{unit_label}} expires on {{expiry_date}}.",
    available_variables: ["landlord_name", "tenant_name", "unit_label", "expiry_date", "renewal_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Lease alert", headline: "A lease is approaching expiry", subheadline: "Time to plan renewal terms or prepare for tenant turnover.", align: "left", emphasis: "default" },
      { id: id(), type: "text", content: "Dear {{landlord_name}},\n\nThe lease for **{{unit_label}}** held by **{{tenant_name}}** is set to expire on **{{expiry_date}}**.", align: "left" },
      { id: id(), type: "callout", tone: "info", title: "Why 90 days?", body: "UAE Law 33/2008 requires 90 days written notice for any change in lease terms (rent, conditions, or non-renewal)." },
      { id: id(), type: "button", label: "Open Lease", href: "{{renewal_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "alert.maintenance_urgent",
    category: "alert",
    name: "Urgent Maintenance Issue",
    description: "High-priority maintenance escalation.",
    subject: "Urgent: {{request_title}} — {{unit_label}}",
    preheader: "An urgent maintenance issue needs your attention.",
    available_variables: ["landlord_name", "request_title", "unit_label", "request_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Urgent", headline: "{{request_title}}", subheadline: "An urgent maintenance issue has been reported at {{unit_label}}.", align: "left", emphasis: "danger" },
      { id: id(), type: "callout", tone: "danger", body: "Our team has been dispatched. We will keep you posted on progress." },
      { id: id(), type: "button", label: "View Request", href: "{{request_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },

  // ─────────── QUOTES ───────────
  {
    template_key: "quote.invitation",
    category: "quote",
    name: "Quote Invitation — Vendor",
    description: "Invite a vendor to submit a quote for a service request.",
    subject: "Quote request: {{request_summary}}",
    preheader: "Submit your quote by {{deadline}}.",
    available_variables: ["vendor_name", "request_summary", "property_name", "quote_url", "deadline"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Quote request", headline: "We'd like a quote from you", subheadline: "Post Build is requesting a quote for the work below.", align: "left", emphasis: "default" },
      { id: id(), type: "text", content: "Dear {{vendor_name}},\n\nPlease review the details below and submit your quote at your earliest convenience.", align: "left" },
      { id: id(), type: "table", title: "Job details", rows: [
        { label: "Scope", value: "{{request_summary}}" },
        { label: "Property", value: "{{property_name}}" },
        { label: "Submit by", value: "{{deadline}}" },
      ] },
      { id: id(), type: "button", label: "Submit Your Quote", href: "{{quote_url}}", align: "center", variant: "primary" },
      { id: id(), type: "text", content: "The quote link is unique to you and will expire after {{deadline}}.", align: "left" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "quote.accepted",
    category: "quote",
    name: "Quote Accepted — Vendor",
    description: "Confirms acceptance of a vendor's quote.",
    subject: "Your quote was accepted — {{request_summary}}",
    preheader: "Congratulations — your quote was selected.",
    available_variables: ["vendor_name", "request_summary", "request_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Good news", headline: "Your quote was accepted", subheadline: "Thank you for your competitive proposal.", align: "left", emphasis: "success" },
      { id: id(), type: "text", content: "Hi {{vendor_name}},\n\nWe've accepted your quote for **{{request_summary}}**. Please coordinate scheduling via the request link below.", align: "left" },
      { id: id(), type: "button", label: "Open Work Order", href: "{{request_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },

  // ─────────── NOTICES ───────────
  {
    template_key: "notice.demand_letter",
    category: "notice",
    name: "Formal Demand Letter — Tenant",
    description: "Formal payment demand (UAE Notice 25).",
    subject: "Formal Notice — Outstanding rent at {{unit_label}}",
    preheader: "Formal demand for outstanding rent.",
    available_variables: ["tenant_name", "unit_label", "amount_due", "due_date", "days_past_due", "legal_reference", "effective_date"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Formal notice", headline: "Notice of Outstanding Rent", subheadline: "Issued under {{legal_reference}}.", align: "left", emphasis: "danger" },
      { id: id(), type: "text", content: "Dear {{tenant_name}},\n\nThis is a formal notice that the rent for **{{unit_label}}** in the amount of **{{amount_due}}**, due on **{{due_date}}**, remains unpaid as of today ({{days_past_due}} days overdue).", align: "left" },
      { id: id(), type: "callout", tone: "danger", title: "Action required within 30 days",
        body: "You are required to settle the outstanding balance within thirty (30) days of receiving this notice. Failure to do so may result in legal proceedings being initiated, including filing with the Rental Dispute Centre and potential eviction." },
      { id: id(), type: "table", title: "Reference", rows: [
        { label: "Effective date", value: "{{effective_date}}" },
        { label: "Legal reference", value: "{{legal_reference}}" },
      ] },
      { id: id(), type: "text", content: "We hope to resolve this matter amicably. Please contact us immediately to arrange payment.", align: "left" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "notice.notice_to_vacate",
    category: "notice",
    name: "Notice to Vacate",
    description: "12-month formal notice to vacate.",
    subject: "Notice to Vacate — {{unit_label}}",
    preheader: "Formal notice to vacate {{unit_label}} by {{effective_date}}.",
    available_variables: ["tenant_name", "unit_label", "effective_date", "notice_type", "legal_reference"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Formal notice", headline: "Notice to Vacate", subheadline: "Issued in accordance with {{legal_reference}}.", align: "left", emphasis: "warning" },
      { id: id(), type: "text", content: "Dear {{tenant_name}},\n\nThis serves as your formal **{{notice_type}}** for the property at **{{unit_label}}**. You are requested to vacate the premises on or before **{{effective_date}}**.", align: "left" },
      { id: id(), type: "callout", tone: "info", title: "Your rights",
        body: "Under UAE rental law you are entitled to receive twelve (12) months written notice via notary public or registered mail before being required to vacate." },
      clone(FOOTER),
    ],
  },

  // ─────────── SERVICE REQUESTS ───────────
  {
    template_key: "service_request.created",
    category: "service_request",
    name: "Service Request Received",
    description: "Confirms a new service request has been logged.",
    subject: "We received your request — {{request_title}}",
    preheader: "Reference {{request_id}}.",
    available_variables: ["tenant_name", "request_title", "request_id", "unit_label", "request_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Request received", headline: "We're on it", subheadline: "Thank you for reporting the issue. We've logged your request and a team member will be in touch shortly.", align: "left", emphasis: "success" },
      { id: id(), type: "table", title: "Your request", rows: [
        { label: "Title", value: "{{request_title}}" },
        { label: "Reference", value: "{{request_id}}" },
        { label: "Unit", value: "{{unit_label}}" },
      ] },
      { id: id(), type: "button", label: "Track Request", href: "{{request_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "service_request.assigned",
    category: "service_request",
    name: "Service Request — Vendor Assigned",
    description: "Notifies tenant that a vendor has been assigned.",
    subject: "{{vendor_name}} has been assigned to your request",
    preheader: "Scheduled for {{scheduled_at}}.",
    available_variables: ["tenant_name", "request_title", "vendor_name", "scheduled_at", "request_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Update", headline: "A specialist is on the way", subheadline: "**{{vendor_name}}** will handle your request.", align: "left", emphasis: "default" },
      { id: id(), type: "table", title: "Visit details", rows: [
        { label: "Vendor", value: "{{vendor_name}}" },
        { label: "Request", value: "{{request_title}}" },
        { label: "Scheduled", value: "{{scheduled_at}}" },
      ] },
      { id: id(), type: "button", label: "View Details", href: "{{request_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },

  // ─────────── WORK UPDATES ───────────
  {
    template_key: "work_update.in_progress",
    category: "work_update",
    name: "Work Started",
    description: "Notifies all parties that work has begun.",
    subject: "Work started — {{request_title}}",
    preheader: "Status updated to {{status_label}}.",
    available_variables: ["request_title", "status_label", "vendor_name", "request_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Status: {{status_label}}", headline: "Work has begun on {{request_title}}", subheadline: "**{{vendor_name}}** is now on-site and working on your request.", align: "left", emphasis: "default" },
      { id: id(), type: "button", label: "Track Progress", href: "{{request_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "work_update.completed",
    category: "work_update",
    name: "Work Completed",
    description: "Notifies parties that work is done. Includes feedback link.",
    subject: "Completed: {{request_title}}",
    preheader: "Please leave feedback for {{vendor_name}}.",
    available_variables: ["request_title", "vendor_name", "request_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Completed", headline: "All done", subheadline: "**{{vendor_name}}** has completed the work for **{{request_title}}**.", align: "left", emphasis: "success" },
      { id: id(), type: "text", content: "Take a moment to confirm everything looks good and rate your experience. Your feedback helps us keep our vendor network high-quality.", align: "left" },
      { id: id(), type: "button", label: "Confirm & Rate", href: "{{request_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },

  // ─────────── CONFIRMATIONS ───────────
  {
    template_key: "confirmation.payment_received",
    category: "confirmation",
    name: "Payment Received",
    description: "Confirms receipt of a tenant payment.",
    subject: "Payment received — {{reference}}",
    preheader: "Your payment of {{amount}} has been recorded.",
    available_variables: ["recipient_name", "amount", "reference", "date", "details_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Receipt", headline: "Payment received", subheadline: "We've recorded your payment. Thank you.", align: "left", emphasis: "success" },
      { id: id(), type: "table", title: "Receipt", rows: [
        { label: "Paid by", value: "{{recipient_name}}" },
        { label: "Amount", value: "{{amount}}" },
        { label: "Reference", value: "{{reference}}" },
        { label: "Date", value: "{{date}}" },
      ] },
      { id: id(), type: "button", label: "View Receipt", href: "{{details_url}}", align: "center", variant: "outline" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "confirmation.welcome",
    category: "confirmation",
    name: "Welcome Email",
    description: "Onboarding welcome for new owners and tenants.",
    subject: "Welcome to {{company_name}}",
    preheader: "Your account is ready.",
    available_variables: ["recipient_name", "details_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Welcome", headline: "We're glad you're here", subheadline: "Your account is ready. Below is everything you need to get started.", align: "left", emphasis: "default" },
      { id: id(), type: "text", content: "Hi {{recipient_name}},\n\nThanks for choosing Post Build. We've designed our platform to give you transparent, real-time visibility into your property — from rent to maintenance to financials.", align: "left" },
      { id: id(), type: "button", label: "Open Your Dashboard", href: "{{details_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },
  {
    template_key: "confirmation.lease_signed",
    category: "confirmation",
    name: "Lease Signed Confirmation",
    description: "Confirms a lease has been countersigned.",
    subject: "Your lease for {{unit_label}} is signed",
    preheader: "Welcome home.",
    available_variables: ["recipient_name", "unit_label", "details_url"],
    blocks: [
      clone(HEADER),
      { id: id(), type: "hero", eyebrow: "Signed", headline: "Welcome home", subheadline: "Your lease for **{{unit_label}}** has been finalised.", align: "left", emphasis: "success" },
      { id: id(), type: "text", content: "Hi {{recipient_name}},\n\nThe signed copy of your lease is attached for your records.", align: "left" },
      { id: id(), type: "button", label: "Open Lease Details", href: "{{details_url}}", align: "center", variant: "primary" },
      clone(FOOTER),
    ],
  },
];