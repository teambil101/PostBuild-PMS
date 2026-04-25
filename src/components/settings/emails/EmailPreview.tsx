import { useMemo } from "react";
import type { BrandTokens, EmailBlock } from "@/lib/email-blocks";
import { renderTemplateHtml, CATEGORY_VARIABLES } from "@/lib/email-blocks";

interface Props {
  blocks: EmailBlock[];
  brand: BrandTokens;
  preheader?: string;
  category?: keyof typeof CATEGORY_VARIABLES | string;
}

export function EmailPreview({ blocks, brand, preheader, category }: Props) {
  const html = useMemo(() => {
    const vars: Record<string, string> = {
      company_name: brand.companyName || "Post Build",
    };
    const cat = category && CATEGORY_VARIABLES[category];
    if (cat) for (const v of cat) vars[v.key] = v.example;
    return renderTemplateHtml(blocks, brand, vars, preheader);
  }, [blocks, brand, preheader, category]);

  return (
    <iframe
      title="Email preview"
      srcDoc={html}
      className="w-full h-[720px] border border-border rounded-sm bg-white"
      sandbox="allow-same-origin"
    />
  );
}