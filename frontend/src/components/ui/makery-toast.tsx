import React from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, Circle } from "lucide-react";

export const TOAST_COLORS = {
  success: {
    accent: "#7A9BFF",
    iconBg: "rgba(122, 155, 255, 0.25)",
    iconFg: "#7A9BFF",
  },
  info: {
    accent: "#7ED9A7",
    iconBg: "rgba(126, 217, 167, 0.25)",
    iconFg: "#7ED9A7",
  },
  warning: {
    accent: "#FFE593",
    iconBg: "rgba(255, 229, 147, 0.25)",
    iconFg: "#FFE593",
  },
  error: {
    accent: "#FF8A8A",
    iconBg: "rgba(255, 138, 138, 0.25)",
    iconFg: "#FF8A8A",
  },
  default: {
    accent: "#A4A7B5",
    iconBg: "rgba(164, 167, 181, 0.25)",
    iconFg: "#A4A7B5",
  },
} as const;

export type ToastStatus = keyof typeof TOAST_COLORS;

const STATUS_ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  default: Circle,
};

export function MakeryToastLayout({
  status = "default",
  title,
  description,
  icon,
}: {
  status?: ToastStatus;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  const c = TOAST_COLORS[status];
  const IconComponent = STATUS_ICONS[status];
  const displayIcon = icon ?? <IconComponent className="h-4 w-4" />;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-[#18181F] px-4 py-3 shadow-lg">
      {/* 왼쪽 컬러 바 */}
      <div
        className="w-1 self-stretch rounded-full"
        style={{ backgroundColor: c.accent }}
      />

      {/* 동그란 아이콘 */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: c.iconBg, color: c.iconFg }}
      >
        {displayIcon}
      </div>

      {/* 텍스트 */}
      <div className="flex flex-col gap-0.5">
        {title && (
          <p className="text-sm font-semibold text-white">{title}</p>
        )}
        {description && (
          <p className="text-xs text-slate-300">{description}</p>
        )}
      </div>
    </div>
  );
}

