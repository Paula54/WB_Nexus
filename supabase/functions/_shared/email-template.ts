// Master HTML template for newsletters and transactional emails
// Wraps user content with branded header (logo), footer (unsubscribe + social)

export interface BrandData {
  trade_name?: string | null;
  legal_name?: string | null;
  logo_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  website?: string | null;
  email?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

export interface RenderOptions {
  subject: string;
  contentHtml: string;
  brand: BrandData;
  unsubscribeUrl: string;
  preheader?: string;
}

const social = (url: string | null | undefined, label: string, svg: string) =>
  url
    ? `<a href="${url}" style="display:inline-block;margin:0 6px;text-decoration:none;" target="_blank" rel="noopener" aria-label="${label}">${svg}</a>`
    : "";

const ICON_FB = `<span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#1877F2;color:#fff;border-radius:50%;font-family:Arial,sans-serif;font-weight:bold;font-size:16px;">f</span>`;
const ICON_IG = `<span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;border-radius:50%;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">IG</span>`;
const ICON_LI = `<span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#0A66C2;color:#fff;border-radius:50%;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">in</span>`;

export function renderEmailTemplate(opts: RenderOptions): string {
  const { subject, contentHtml, brand, unsubscribeUrl, preheader } = opts;
  const brandName = brand.trade_name || brand.legal_name || "Nexus";
  const logo = brand.logo_url
    ? `<img src="${brand.logo_url}" alt="${brandName}" style="max-height:60px;max-width:200px;display:block;margin:0 auto;" />`
    : `<div style="font-size:28px;font-weight:bold;color:#fff;text-align:center;font-family:Arial,sans-serif;">${brandName}</div>`;

  const addressLine = [brand.address_line1, brand.postal_code, brand.city]
    .filter(Boolean)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a2e;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f7;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 24px;">
        ${logo}
      </td></tr>

      <!-- CONTENT -->
      <tr><td style="padding:32px 28px;font-size:16px;line-height:1.6;color:#2a2a3a;">
        ${contentHtml}
      </td></tr>

      <!-- SOCIAL -->
      ${
        brand.facebook_url || brand.instagram_url || brand.linkedin_url
          ? `<tr><td style="padding:0 28px 24px;text-align:center;">
              ${social(brand.facebook_url, "Facebook", ICON_FB)}
              ${social(brand.instagram_url, "Instagram", ICON_IG)}
              ${social(brand.linkedin_url, "LinkedIn", ICON_LI)}
            </td></tr>`
          : ""
      }

      <!-- FOOTER -->
      <tr><td style="background:#f9fafb;padding:24px 28px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;line-height:1.5;">
        <p style="margin:0 0 8px;font-weight:600;color:#374151;">${escapeHtml(brandName)}</p>
        ${addressLine ? `<p style="margin:0 0 8px;">${escapeHtml(addressLine)}</p>` : ""}
        ${brand.website ? `<p style="margin:0 0 12px;"><a href="${brand.website}" style="color:#6366f1;text-decoration:none;">${escapeHtml(brand.website)}</a></p>` : ""}
        <p style="margin:12px 0 0;">
          Recebeu este email porque subscreveu a nossa lista.<br/>
          <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Cancelar subscrição</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
