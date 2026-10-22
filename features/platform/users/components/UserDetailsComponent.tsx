"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { basePath } from "@/features/dashboard/lib/config";
import { Facts, Pill, StatusDot, TitleLine, Track, type DeskTone } from "@/features/platform/components/desk";
import { EditItemDrawerClientWrapper } from "../../components/EditItemDrawerClientWrapper";

interface UserDetailsComponentProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    isSalesperson?: boolean | null;
    isServiceAdvisor?: boolean | null;
    isFinanceManager?: boolean | null;
    role?: { id: string; name: string } | null;
    assignedLeadsCount?: number | null;
    dealsCount?: number | null;
    createdAt?: string | null;
  };
  list: any;
}

export function UserDetailsComponent({ user }: UserDetailsComponentProps) {
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const leads = user.assignedLeadsCount ?? 0;
  const deals = user.dealsCount ?? 0;
  const roleBadges: Array<{ label: string; tone: DeskTone }> = [];
  if (user.isSalesperson) roleBadges.push({ label: "Sales", tone: "info" });
  if (user.isServiceAdvisor) roleBadges.push({ label: "Service", tone: "warn" });
  if (user.isFinanceManager) roleBadges.push({ label: "Finance", tone: "accent" });
  const displayName = user.name || user.email;
  const joined = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <>
      <div className="min-w-0 px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <TitleLine as="h3" tone={user.role ? "ok" : "idle"} status={user.role ? user.role.name : "No role"} className="text-sm font-medium text-foreground">
              <Link href={`${basePath}/users/${user.id}`} className="hover:underline">
                {displayName}
              </Link>
              <span className="font-normal text-muted-foreground"> · {user.role ? user.role.name : "No role"}</span>
            </TitleLine>
            <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 pl-4 text-xs text-muted-foreground">
              {user.email && <span className="break-all">{user.email}</span>}
              {user.phone && <span>{user.phone}</span>}
              {roleBadges.map((badge) => (
                <span key={badge.label} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em]">
                  <StatusDot tone={badge.tone} className="size-1.5 shadow-none" />
                  {badge.label}
                </span>
              ))}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-3">
            <div className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground sm:block">
              <p>{leads} {leads === 1 ? "lead" : "leads"}</p>
              <p>{deals} {deals === 1 ? "deal" : "deals"}</p>
            </div>
            <Track>
              <Pill size="sm" variant={isOpen ? undefined : "plain"} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
                Details
              </Pill>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Pill size="sm" variant="plain" aria-label={`Actions for ${displayName}`}>
                    <MoreHorizontal />
                  </Pill>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditDrawerOpen(true)}>
                    Edit staff member
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`${basePath}/users/${user.id}`}>Open full record</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Track>
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 rounded-lg bg-muted/40 px-3 sm:ml-4">
            <Facts
              items={[
                { label: "Email", value: user.email || "None" },
                { label: "Phone", value: user.phone || "None" },
                { label: "Role", value: user.role?.name || "None" },
                { label: "Functions", value: roleBadges.length ? roleBadges.map((badge) => badge.label).join(", ") : "None" },
                { label: "Assigned leads", value: leads, mono: true },
                { label: "Deals", value: deals, mono: true },
                joined ? { label: "Joined", value: joined } : null,
              ]}
            />
          </div>
        )}
      </div>

      <EditItemDrawerClientWrapper
        listKey="users"
        itemId={user.id}
        open={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        onSave={() => {
          window.location.reload();
        }}
      />
    </>
  );
}
