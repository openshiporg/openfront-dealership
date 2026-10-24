'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { PageContainer } from '@/features/dashboard/components/PageContainer'
import { basePath } from '@/features/dashboard/lib/config'
import { DeskHeader, Notice, Pill, Segmented, Track } from '@/features/platform/components/desk'
import { AccessSection } from '../components/AccessSection'
import { DealerGroupSection } from '../components/DealerGroupSection'
import { RetentionSection } from '../components/RetentionSection'
import { RolesSection } from '../components/RolesSection'
import { RooftopsSection } from '../components/RooftopsSection'
import type { OrganizationData, OrganizationTab } from '../lib/types'

export function OrganizationPageClient({
  data,
  initialTab,
  timeZone,
}: {
  data: OrganizationData
  initialTab: OrganizationTab
  timeZone: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<OrganizationTab>(initialTab)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshing, startRefresh] = useTransition()

  const changeTab = (next: OrganizationTab) => {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'group') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    window.history.replaceState(null, '', url.toString())
  }

  const refresh = () => startRefresh(() => router.refresh())
  const onChanged = (message: string) => {
    setNotice(message)
    refresh()
  }

  const group = data.dealerGroups[0]
  const activeRooftops = data.rooftops.filter(rooftop => rooftop.status === 'active').length
  const activeMembers = data.memberships.filter(membership => membership.status === 'active').length
  const pendingInvites = data.memberships.filter(membership => membership.status === 'invited').length

  const breadcrumbs = [
    { type: 'link' as const, label: 'Dashboard', href: basePath },
    { type: 'page' as const, label: 'Platform' },
    { type: 'page' as const, label: 'Organization' },
  ]

  const header = (
    <DeskHeader
      title={group?.name || 'Organization'}
      eyebrow="Organization"
      tone={data.errors.organization ? 'bad' : group ? (group.status === 'active' ? 'ok' : 'warn') : 'idle'}
      status={data.errors.organization ? 'Unavailable' : group ? group.status : 'Not set up'}
      meta={`${activeRooftops} active rooftops · ${activeMembers} active members${pendingInvites ? ` · ${pendingInvites} invited` : ''} · ${data.roles.length} roles`}
      actions={
        <Track>
          <Pill className="h-11 sm:h-8" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? 'animate-spin' : undefined} />
            Refresh
          </Pill>
        </Track>
      }
    />
  )

  return (
    <PageContainer title="Organization" header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 max-w-full space-y-4 px-4 pb-24 md:px-6">
        <Segmented<OrganizationTab>
          label="Organization section"
          value={tab}
          onChange={changeTab}
          options={[
            { value: 'group', label: 'Dealer group' },
            { value: 'rooftops', label: 'Rooftops', count: data.rooftops.length },
            { value: 'access', label: 'Access', count: activeMembers },
            { value: 'roles', label: 'Roles', count: data.roles.length },
            { value: 'retention', label: 'Retention' },
          ]}
        />

        {notice && (
          <Notice tone="ok">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
              <p className="min-w-0">{notice}</p>
              <Track><Pill size="sm" variant="plain" onClick={() => setNotice(null)}>Dismiss</Pill></Track>
            </div>
          </Notice>
        )}

        {data.errors.organization && (tab === 'group' || tab === 'rooftops') ? (
          <Notice tone="bad">
            <p className="font-medium">Organization unavailable</p>
            <p className="mt-0.5 text-muted-foreground">{data.errors.organization}</p>
            <Track className="mt-2"><Pill size="sm" onClick={refresh}>Retry</Pill></Track>
          </Notice>
        ) : tab === 'group' ? (
          <DealerGroupSection groups={data.dealerGroups} viewer={data.viewer} timeZone={timeZone} onChanged={onChanged} />
        ) : tab === 'rooftops' ? (
          <RooftopsSection rooftops={data.rooftops} groups={data.dealerGroups} viewer={data.viewer} onChanged={onChanged} />
        ) : tab === 'access' ? (
          <AccessSection
            memberships={data.memberships}
            auditEvents={data.auditEvents}
            groups={data.dealerGroups}
            rooftops={data.rooftops}
            roles={data.roles}
            staff={data.staff}
            viewer={data.viewer}
            timeZone={timeZone}
            errors={{ access: data.errors.access, audit: data.errors.audit, staff: data.errors.staff }}
            onChanged={onChanged}
          />
        ) : tab === 'roles' ? (
          <RolesSection roles={data.roles} viewer={data.viewer} error={data.errors.roles} onChanged={onChanged} />
        ) : (
          <RetentionSection rooftops={data.rooftops} policies={data.retentionPolicies} viewer={data.viewer} timeZone={timeZone} error={data.errors.retention} onChanged={onChanged} />
        )}
      </div>
    </PageContainer>
  )
}
