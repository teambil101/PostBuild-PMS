import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 md:mb-10 flex flex-col gap-4 md:gap-6 md:flex-row md:items-end md:justify-between border-b hairline pb-5 md:pb-6">
      <div className="space-y-2 max-w-2xl min-w-0">
        {eyebrow && <div className="label-eyebrow">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-architect leading-tight break-words">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap [&>*]:shrink-0">{actions}</div>
      )}
    </div>
  );
}
