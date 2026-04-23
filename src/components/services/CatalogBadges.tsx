import { cn } from "@/lib/utils";
import {
  BILLING_LABEL,
  BILLING_STYLES,
  CATEGORY_LABEL,
  DELIVERY_LABEL,
  type ServiceBilling,
  type ServiceCategory,
  type ServiceDelivery,
} from "@/lib/services";

export function BillingBadge({ value }: { value: ServiceBilling }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border hairline",
        BILLING_STYLES[value],
      )}
    >
      {BILLING_LABEL[value]}
    </span>
  );
}

export function DeliveryBadge({ value }: { value: ServiceDelivery }) {
  return (
    <span className="inline-flex items-center text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border hairline text-muted-foreground">
      {DELIVERY_LABEL[value]}
    </span>
  );
}

export function CategoryBadge({ value }: { value: ServiceCategory }) {
  return (
    <span className="inline-flex items-center text-[10px] uppercase tracking-wider text-muted-foreground">
      {CATEGORY_LABEL[value]}
    </span>
  );
}
