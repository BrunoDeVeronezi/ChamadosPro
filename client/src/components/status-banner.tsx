import { AlertCircle, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type BannerVariant = "warning" | "error" | "success" | "info";

interface StatusBannerProps {
  variant: BannerVariant;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  dismissible: boolean;
}

const variantStyles = {
  warning: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-100",
  error: "bg-destructive/10 border-destructive/20 text-destructive dark:bg-destructive/20",
  success: "bg-green-50 border-green-200 text-green-900 dark:bg-green-950 dark:border-green-800 dark:text-green-100",
  info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100",
};

const iconMap = {
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
  info: AlertCircle,
};

export function StatusBanner({
  variant,
  title,
  message,
  actionLabel,
  onAction,
  dismissible = false,
}: StatusBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const Icon = iconMap[variant];

  if (dismissed) return null;

  return (
    <div className={`w-full border-b py-3 px-6 flex items-center justify-between ${variantStyles[variant]}`} data-testid={`banner-${variant}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm opacity-90">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actionLabel && onAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAction}
            className="border-current text-current hover-elevate"
            data-testid="button-banner-action"
          >
            {actionLabel}
          </Button>
        )}
        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 text-current"
            data-testid="button-banner-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
