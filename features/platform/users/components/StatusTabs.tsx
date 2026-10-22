"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Segmented, type DeskTone } from "@/features/platform/components/desk";

const statusConfig = {
  sales: {
    label: "Sales",
    filterKey: "!isSalesperson_is",
    tone: "info",
  },
  service: {
    label: "Service",
    filterKey: "!isServiceAdvisor_is",
    tone: "warn",
  },
  finance: {
    label: "Finance",
    filterKey: "!isFinanceManager_is",
    tone: "accent",
  },
} as const satisfies Record<string, { label: string; filterKey: string; tone: DeskTone }>;

type StaffStatus = keyof typeof statusConfig;

interface StatusTabsProps {
  statusCounts: {
    all: number;
    sales: number;
    service: number;
    finance: number;
  };
}

export function StatusTabs({ statusCounts }: StatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams()!;
  const pathname = usePathname();

  // Get current status from URL
  const currentStatus =
    (Object.keys(statusConfig) as StaffStatus[]).find(
      (status) => searchParams.get(statusConfig[status].filterKey) === "true"
    ) ?? "all";

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when changing status
    params.set("page", "1");

    for (const config of Object.values(statusConfig)) {
      params.delete(config.filterKey);
    }
    if (status in statusConfig) {
      params.set(statusConfig[status as StaffStatus].filterKey, "true");
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const options = [
    { value: "all", label: "All staff", count: statusCounts.all },
    ...(Object.keys(statusConfig) as StaffStatus[]).map((status) => ({
      value: status,
      label: statusConfig[status].label,
      count: statusCounts[status],
      tone: statusConfig[status].tone as DeskTone,
    })),
  ];

  return (
    <Segmented
      label="Filter staff by role"
      value={currentStatus as string}
      onChange={handleStatusChange}
      options={options}
    />
  );
}
