import type { BrandTokens, EmailBlock, CalloutBlock, ButtonBlock, FooterBlock } from "./types";

/** Replace {{var}} placeholders with values, leave unknown vars intact. */
export function interpolate(input: string, vars: Record<string, string | number | undefined>): string {
  return input.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alignCss(a?: string) {
  return `text-align: ${a || "left"};`;
}

function calloutColors(tone: CalloutBlock["tone"]): { bg: string; border: string; fg: string } {
  switch (tone) {
    case "danger":
      return { bg: "#FEF2F2", border: "#DC2626", fg: "#7F1D1D" };
    case "warning":
      return { bg: "#FFFBEB", border: "#D97706", fg: "#78350F" };
    case "success":
      return { bg: "#F0FDF4", border: "#16A34A", fg: "#14532D" };
    case "info":
      return { bg: "#EFF6FF", border: "#2563EB", fg: "#1E3A8A" };
    default:
      return { bg: "#F5F5F4", border: "#A8A29E", fg: "#44403C" };
  }
}

function buttonStyle(b: ButtonBlock, brand: BrandTokens): string {
  const base = `display:inline-block;padding:14px 28px;font-weight:600;font-size:14px;letter-spacing:0.02em;text-decoration:none;border-radius:${brand.borderRadiusPx}px;`;
  switch (b.variant) {
    case "secondary":
      return `${base}background:${brand.accent};color:${brand.primary};border:1px solid ${brand.accent};`;
    case "outline":
      return `${base}background:transparent;color:${brand.primary};border:1px solid ${brand.primary};`;
    default:
      return `${base}background:${brand.primary};color:#ffffff;border:1px solid ${brand.primary};`;
  }
}

function renderBlock(block: EmailBlock, brand: BrandTokens, vars: Record<string, string | number | undefined>): string {
  const interp = (s: string) => interpolate(s, vars);
  const headingFont = brand.headingFontFamily || brand.fontFamily;

  switch (block.type) {
    case "header": {
      const inner: string[] = [];
      if (block.showLogo && brand.logoUrl) {
        inner.push(
          `<img src="${escapeHtml(brand.logoUrl)}" alt="${escapeHtml(brand.companyName || "Logo")}" height="40" style="max-height:40px;display:inline-block;border:0;outline:none;text-decoration:none;" />`,
        );
      }
      if (block.showCompanyName && brand.companyName) {
        inner.push(
          `<div style="font-family:${headingFont};font-size:20px;font-weight:600;color:${brand.primary};margin-top:${block.showLogo ? 8 : 0}px;letter-spacing:0.02em;">${escapeHtml(brand.companyName)}</div>`,
        );
      }
      return `<tr><td style="padding:32px 32px 16px 32px;${alignCss(block.align)}">${inner.join("")}</td></tr>`;
    }

    case "hero": {
      const tones: Record<string, string> = {
        warning: brand.accent,
        danger: "#DC2626",
        success: "#16A34A",
        default: brand.primary,
      };
      const accentBar = tones[block.emphasis || "default"];
      return `<tr><td style="padding:32px 32px 8px 32px;${alignCss(block.align)}">
        ${block.eyebrow ? `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${accentBar};font-weight:600;margin-bottom:12px;">${escapeHtml(interp(block.eyebrow))}</div>` : ""}
        <h1 style="font-family:${headingFont};font-size:32px;line-height:1.2;font-weight:500;color:${brand.text};margin:0 0 12px 0;">${escapeHtml(interp(block.headline))}</h1>
        ${block.subheadline ? `<p style="font-size:16px;line-height:1.55;color:${brand.mutedText};margin:0;">${escapeHtml(interp(block.subheadline))}</p>` : ""}
      </td></tr>`;
    }

    case "heading": {
      const sizes = { 1: 26, 2: 20, 3: 16 };
      return `<tr><td style="padding:24px 32px 8px 32px;${alignCss(block.align)}">
        <h${block.level} style="font-family:${headingFont};font-size:${sizes[block.level]}px;font-weight:600;color:${brand.text};margin:0;line-height:1.3;">${escapeHtml(interp(block.text))}</h${block.level}>
      </td></tr>`;
    }

    case "text": {
      // Allow simple **bold** markup
      const html = escapeHtml(interp(block.content)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
      return `<tr><td style="padding:8px 32px;${alignCss(block.align)}">
        <p style="font-size:15px;line-height:1.65;color:${brand.text};margin:0;">${html}</p>
      </td></tr>`;
    }

    case "button": {
      return `<tr><td style="padding:24px 32px;${alignCss(block.align)}">
        <a href="${escapeHtml(interp(block.href))}" style="${buttonStyle(block, brand)}">${escapeHtml(interp(block.label))}</a>
      </td></tr>`;
    }

    case "image": {
      return `<tr><td style="padding:16px 32px;${alignCss(block.align)}">
        <img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" ${block.widthPx ? `width="${block.widthPx}"` : ""} style="max-width:100%;height:auto;display:inline-block;border:0;border-radius:${brand.borderRadiusPx}px;" />
      </td></tr>`;
    }

    case "divider":
      return `<tr><td style="padding:16px 32px;"><div style="border-top:1px solid #E7E5E4;"></div></td></tr>`;

    case "spacer":
      return `<tr><td style="height:${block.heightPx}px;line-height:${block.heightPx}px;font-size:1px;">&nbsp;</td></tr>`;

    case "callout": {
      const c = calloutColors(block.tone);
      const body = escapeHtml(interp(block.body)).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
      return `<tr><td style="padding:12px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};border-left:3px solid ${c.border};border-radius:${brand.borderRadiusPx}px;">
          <tr><td style="padding:16px 18px;">
            ${block.title ? `<div style="font-weight:600;color:${c.fg};font-size:14px;margin-bottom:4px;">${escapeHtml(interp(block.title))}</div>` : ""}
            <div style="font-size:14px;line-height:1.55;color:${c.fg};">${body}</div>
          </td></tr>
        </table>
      </td></tr>`;
    }

    case "table": {
      const rows = block.rows
        .map(
          (r) => `<tr>
            <td style="padding:10px 0;font-size:13px;color:${brand.mutedText};border-bottom:1px solid #EDEAE6;width:40%;">${escapeHtml(interp(r.label))}</td>
            <td style="padding:10px 0;font-size:14px;color:${brand.text};border-bottom:1px solid #EDEAE6;font-weight:500;text-align:right;">${escapeHtml(interp(r.value))}</td>
          </tr>`,
        )
        .join("");
      return `<tr><td style="padding:8px 32px 16px 32px;">
        ${block.title ? `<div style="font-family:${headingFont};font-size:14px;font-weight:600;color:${brand.text};margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(interp(block.title))}</div>` : ""}
        <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>`;
    }

    case "footer": {
      const f = block as FooterBlock;
      const socials: string[] = [];
      const link = (label: string, href: string) =>
        `<a href="${escapeHtml(href)}" style="color:${brand.mutedText};text-decoration:none;margin:0 8px;font-size:12px;">${label}</a>`;
      if (brand.socialWebsite) socials.push(link("Website", brand.socialWebsite));
      if (brand.socialLinkedin) socials.push(link("LinkedIn", brand.socialLinkedin));
      if (brand.socialInstagram) socials.push(link("Instagram", brand.socialInstagram));
      if (brand.socialFacebook) socials.push(link("Facebook", brand.socialFacebook));
      if (brand.socialX) socials.push(link("X", brand.socialX));
      return `<tr><td style="padding:32px;text-align:center;border-top:1px solid #EDEAE6;background:#FBFAF8;">
        ${f.customText ? `<p style="font-size:12px;color:${brand.mutedText};margin:0 0 12px 0;line-height:1.6;">${escapeHtml(interp(f.customText))}</p>` : ""}
        ${f.showSocial && socials.length ? `<div style="margin-bottom:12px;">${socials.join("")}</div>` : ""}
        ${f.showAddress && brand.companyAddress ? `<p style="font-size:11px;color:${brand.mutedText};margin:0 0 8px 0;line-height:1.5;">${escapeHtml(brand.companyAddress)}</p>` : ""}
        ${f.showUnsubscribe && brand.unsubscribeUrl ? `<p style="font-size:11px;color:${brand.mutedText};margin:0;"><a href="${escapeHtml(brand.unsubscribeUrl)}" style="color:${brand.mutedText};">Unsubscribe</a></p>` : ""}
        ${brand.showPoweredBy ? `<p style="font-size:10px;color:${brand.mutedText};margin:8px 0 0 0;letter-spacing:0.08em;text-transform:uppercase;">Sent via Post Build</p>` : ""}
      </td></tr>`;
    }
  }
}

export function renderTemplateHtml(
  blocks: EmailBlock[],
  brand: BrandTokens,
  vars: Record<string, string | number | undefined> = {},
  preheader?: string,
): string {
  const body = blocks.map((b) => renderBlock(b, brand, vars)).join("");
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;opacity:0;">${escapeHtml(interpolate(preheader, vars))}</div>`
    : "";

  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title></title>
<style>
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse !important; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; }
  a { color: ${brand.primary}; }
</style>
</head>
<body style="margin:0;padding:0;background:${brand.background};font-family:${brand.fontFamily};">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.background};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #EDEAE6;border-radius:${brand.borderRadiusPx}px;overflow:hidden;">
      ${body}
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Plain-text fallback: strip a template down to readable text. */
export function renderPlainText(blocks: EmailBlock[], vars: Record<string, string | number | undefined>): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "hero":
        if (b.eyebrow) out.push(interpolate(b.eyebrow, vars).toUpperCase());
        out.push(interpolate(b.headline, vars));
        if (b.subheadline) out.push(interpolate(b.subheadline, vars));
        out.push("");
        break;
      case "heading":
        out.push(interpolate(b.text, vars));
        out.push("");
        break;
      case "text":
        out.push(interpolate(b.content, vars).replace(/\*\*/g, ""));
        out.push("");
        break;
      case "button":
        out.push(`${interpolate(b.label, vars)}: ${interpolate(b.href, vars)}`);
        out.push("");
        break;
      case "callout":
        if (b.title) out.push(interpolate(b.title, vars));
        out.push(interpolate(b.body, vars).replace(/\*\*/g, ""));
        out.push("");
        break;
      case "table":
        if (b.title) out.push(interpolate(b.title, vars));
        for (const r of b.rows) out.push(`  ${interpolate(r.label, vars)}: ${interpolate(r.value, vars)}`);
        out.push("");
        break;
      case "divider":
        out.push("---");
        out.push("");
        break;
    }
  }
  return out.join("\n").trim();
}