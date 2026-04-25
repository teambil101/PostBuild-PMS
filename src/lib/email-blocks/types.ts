/**
 * Email block type system.
 * A template is a tree of typed blocks that render to email-safe HTML.
 * All variables use {{snake_case}} interpolation.
 */

export type EmailBlockType =
  | "header"
  | "hero"
  | "heading"
  | "text"
  | "button"
  | "image"
  | "divider"
  | "spacer"
  | "table"
  | "callout"
  | "footer";

export type Alignment = "left" | "center" | "right";

interface BaseBlock {
  id: string;
  type: EmailBlockType;
}

export interface HeaderBlock extends BaseBlock {
  type: "header";
  showLogo: boolean;
  showCompanyName: boolean;
  align: Alignment;
}

export interface HeroBlock extends BaseBlock {
  type: "hero";
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  align: Alignment;
  emphasis?: "default" | "warning" | "danger" | "success";
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: Alignment;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  content: string;
  align: Alignment;
}

export interface ButtonBlock extends BaseBlock {
  type: "button";
  label: string;
  href: string;
  align: Alignment;
  variant: "primary" | "secondary" | "outline";
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  align: Alignment;
  widthPx?: number;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

export interface SpacerBlock extends BaseBlock {
  type: "spacer";
  heightPx: number;
}

export interface CalloutBlock extends BaseBlock {
  type: "callout";
  title?: string;
  body: string;
  tone: "info" | "warning" | "danger" | "success" | "neutral";
}

export interface TableRow {
  label: string;
  value: string;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  title?: string;
  rows: TableRow[];
}

export interface FooterBlock extends BaseBlock {
  type: "footer";
  showSocial: boolean;
  showAddress: boolean;
  showUnsubscribe: boolean;
  customText?: string;
}

export type EmailBlock =
  | HeaderBlock
  | HeroBlock
  | HeadingBlock
  | TextBlock
  | ButtonBlock
  | ImageBlock
  | DividerBlock
  | SpacerBlock
  | CalloutBlock
  | TableBlock
  | FooterBlock;

export interface BrandTokens {
  primary: string;
  accent: string;
  background: string;
  text: string;
  mutedText: string;
  fontFamily: string;
  headingFontFamily?: string | null;
  borderRadiusPx: number;
  logoUrl?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  footerText?: string | null;
  socialWebsite?: string | null;
  socialLinkedin?: string | null;
  socialInstagram?: string | null;
  socialFacebook?: string | null;
  socialX?: string | null;
  unsubscribeUrl?: string | null;
  showUnsubscribe: boolean;
  showPoweredBy: boolean;
}

export const DEFAULT_BRAND: BrandTokens = {
  primary: "#2E2C29",
  accent: "#C3A575",
  background: "#F8F6F3",
  text: "#2E2C29",
  mutedText: "#645D52",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  headingFontFamily: "'Cormorant Garamond', 'Times New Roman', serif",
  borderRadiusPx: 2,
  showUnsubscribe: true,
  showPoweredBy: true,
};

/** Variables available per template category. Used by the variable picker. */
export const CATEGORY_VARIABLES: Record<string, { key: string; label: string; example: string }[]> = {
  alert: [
    { key: "tenant_name", label: "Tenant name", example: "Ahmed Al Hosani" },
    { key: "landlord_name", label: "Landlord name", example: "Ms. Fatima" },
    { key: "unit_label", label: "Unit", example: "Marina Heights · 1204" },
    { key: "amount_due", label: "Amount due", example: "AED 8,500" },
    { key: "due_date", label: "Due date", example: "1 Mar 2026" },
    { key: "days_past_due", label: "Days past due", example: "12" },
    { key: "invoice_number", label: "Invoice number", example: "INV-2026-0042" },
    { key: "services_url", label: "Services link", example: "https://app.postbuild.com/services" },
  ],
  quote: [
    { key: "vendor_name", label: "Vendor name", example: "Cool Tech HVAC" },
    { key: "request_summary", label: "Request summary", example: "AC servicing — Unit 1204" },
    { key: "quote_url", label: "Quote submission link", example: "https://..." },
    { key: "deadline", label: "Quote deadline", example: "5 Mar 2026" },
    { key: "property_name", label: "Property name", example: "Marina Heights" },
  ],
  notice: [
    { key: "tenant_name", label: "Tenant name", example: "Ahmed Al Hosani" },
    { key: "unit_label", label: "Unit", example: "Marina Heights · 1204" },
    { key: "notice_type", label: "Notice type", example: "Notice to vacate" },
    { key: "effective_date", label: "Effective date", example: "1 Apr 2026" },
    { key: "legal_reference", label: "Legal reference", example: "Law 33/2008, Article 25" },
  ],
  service_request: [
    { key: "tenant_name", label: "Tenant name", example: "Ahmed Al Hosani" },
    { key: "request_title", label: "Request title", example: "Leaking kitchen tap" },
    { key: "request_id", label: "Request ID", example: "SR-0142" },
    { key: "unit_label", label: "Unit", example: "Marina Heights · 1204" },
    { key: "request_url", label: "Request link", example: "https://..." },
  ],
  work_update: [
    { key: "request_title", label: "Request title", example: "Leaking kitchen tap" },
    { key: "status_label", label: "New status", example: "In progress" },
    { key: "vendor_name", label: "Vendor name", example: "Cool Tech HVAC" },
    { key: "scheduled_at", label: "Scheduled date/time", example: "5 Mar 2026, 10:00" },
    { key: "request_url", label: "Request link", example: "https://..." },
  ],
  confirmation: [
    { key: "recipient_name", label: "Recipient name", example: "Ahmed" },
    { key: "amount", label: "Amount", example: "AED 8,500" },
    { key: "reference", label: "Reference", example: "PMT-0042" },
    { key: "date", label: "Date", example: "1 Mar 2026" },
    { key: "details_url", label: "Details link", example: "https://..." },
  ],
};