import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { statusDotClass, isOverdue, type CalendarItem } from "@/lib/calendar";

interface Props {
  date: string;
  items: CalendarItem[];
  trigger: React.ReactNode;
}

export function CalendarDayPopover({ date, items, trigger }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b hairline">
          <div className="label-eyebrow">{format(new Date(date + "T00:00:00"), "EEE, MMM d, yyyy")}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{items.length} scheduled</div>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y hairline">
          {items.map((it) => {
            const overdue = isOverdue(it);
            const inner = (
              <div className="flex items-start gap-2 px-3 py-2 hover:bg-muted/30 transition-colors">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full mt-1.5 shrink-0",
                    statusDotClass(it.status),
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px] text-muted-foreground">{it.requestNumber}</span>
                    {overdue && (
                      <span className="text-[9px] uppercase tracking-wider text-destructive border border-destructive/40 px-1 rounded-sm">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-architect truncate">{it.title}</div>
                  {it.sublabel && (
                    <div className="text-[11px] text-muted-foreground truncate">{it.sublabel}</div>
                  )}
                </div>
              </div>
            );
            return it.requestId ? (
              <Link key={it.key} to={`/services/requests/${it.requestId}`} className="block">
                {inner}
              </Link>
            ) : (
              <div key={it.key}>{inner}</div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}