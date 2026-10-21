"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, MoreVertical, Phone, Users } from "lucide-react";
import { Badge, coloredBadgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { basePath } from "@/features/dashboard/lib/config";
import { EditItemDrawerClientWrapper } from "../../components/EditItemDrawerClientWrapper";

type BadgeColor = NonNullable<VariantProps<typeof coloredBadgeVariants>["color"]>;

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

  const leads = user.assignedLeadsCount ?? 0;
  const deals = user.dealsCount ?? 0;
  const roleBadges: Array<{ label: string; color: BadgeColor }> = [];
  if (user.isSalesperson) roleBadges.push({ label: "SALES", color: "blue" });
  if (user.isServiceAdvisor) roleBadges.push({ label: "SERVICE", color: "orange" });
  if (user.isFinanceManager) roleBadges.push({ label: "FINANCE", color: "indigo" });

  return (
    <>
      <div className="px-4 md:px-6 py-3 md:py-4 flex justify-between gap-4 w-full border-b relative">
        <div className="flex flex-col items-start text-left gap-2 sm:gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${basePath}/users/${user.id}`}
              className="font-medium text-base hover:text-blue-600 dark:hover:text-blue-400"
            >
              {user.name || user.email}
            </Link>
            {user.createdAt && (
              <>
                <span>‧</span>
                <span className="text-sm font-medium text-muted-foreground/75">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {user.email && (
              <>
                <span className="flex items-center gap-1 break-all">
                  <Mail className="w-3 h-3" />
                  {user.email}
                </span>
                <span>‧</span>
              </>
            )}
            {user.phone && (
              <>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {user.phone}
                </span>
                <span>‧</span>
              </>
            )}
            <span>
              {leads} {leads === 1 ? "lead" : "leads"}
            </span>
            <span>‧</span>
            <span>
              {deals} {deals === 1 ? "deal" : "deals"}
            </span>
          </div>

          {user.role && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>Role: {user.role.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 shrink-0">
          {roleBadges.length > 0 && (
            <div className="hidden sm:flex flex-wrap justify-end gap-1.5">
              {roleBadges.map((badge) => (
                <Badge
                  key={badge.label}
                  color={badge.color}
                  className="text-[.6rem] sm:text-[.7rem] py-0 px-2 sm:px-3 tracking-wide font-medium rounded-md border h-6"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="border [&_svg]:size-3 h-6 w-6"
                aria-label={`Actions for ${user.name || user.email}`}
              >
                <MoreVertical className="stroke-muted-foreground" />
              </Button>
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
        </div>
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
