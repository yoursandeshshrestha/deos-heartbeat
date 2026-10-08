import { useState } from 'react'
import { toast } from 'sonner'
import useSWR from 'swr'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { EngagementPayload } from '@/lib/addon-types'
import { useAuth } from '@/lib/auth'
import { serverFetch } from '@/lib/serverApi'
import { supabase } from '@/lib/supabase'

const fetcher = async (url: string): Promise<EngagementPayload> => {
  const response = await serverFetch(url)
  if (!response.ok) throw new Error(`Engagement API ${response.status}`)
  return response.json()
}

function rate(value: number | null) {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function when(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London' })
}

export function EngagementPage() {
  const { role } = useAuth()
  const { data, error, isLoading, mutate } = useSWR('/api/engagement', fetcher)
  const [batchId, setBatchId] = useState<string | null>(null)

  async function pause(recipientId: string | null) {
    if (!recipientId) return
    const { error: updateError } = await supabase
      .from('recipients')
      .update({ active: false })
      .eq('id', recipientId)
    if (updateError) {
      toast.error(updateError.message)
      return
    }
    toast.success('Recipient paused')
    void mutate()
  }

  if (isLoading && !data) return <PageLoading />
  if (error && !data) {
    return (
      <div className="p-6">
        <PageEmptyState title="Engagement unavailable" description={error.message} />
      </div>
    )
  }
  if (!data) return null

  const selected = data.reports.find((report) => report.batchId === batchId) ?? null
  const quiet = data.recipients.filter((person) => person.quiet)

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-10">
      <div className="grid gap-px overflow-hidden rounded-lg bg-border/70 ring-1 ring-border/70 sm:grid-cols-3">
        <Stat label="Sent this week" value={String(data.sent)} detail={`${data.previousSent} last week`} />
        <Stat label="Detected opens" value={String(data.opened)} detail={`${data.previousOpened} last week`} />
        <Stat
          label="Open rate"
          value={rate(data.openRate)}
          detail={`Previous week ${rate(data.previousOpenRate)}`}
        />
      </div>
      {data.notice ? <p className="text-sm text-muted-foreground">{data.notice}</p> : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trusts">By trust</TabsTrigger>
          <TabsTrigger value="recipients">By recipient</TabsTrigger>
          <TabsTrigger value="reports">By report</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <section>
            <h3 className="mb-2 text-sm font-medium">Eight-week open rate</h3>
            <ul className="space-y-1 text-sm">
              {data.trend.map((week) => (
                <li key={week.week} className="flex justify-between gap-3">
                  <span>{week.week}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {week.opened}/{week.sent} · {rate(week.openRate)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">Quiet for four weeks or more</h3>
            {!quiet.length ? (
              <p className="text-sm text-muted-foreground">No quiet recipients.</p>
            ) : (
              <ul className="divide-y divide-border">
                {quiet.map((person) => (
                  <RecipientRow
                    key={`${person.trustId}-${person.email}`}
                    person={person}
                    canPause={role === 'admin'}
                    onPause={() => void pause(person.recipientId)}
                  />
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            The Wednesday Email Tracking report stays on its existing automation and keeps the same content.
            This dashboard covers the daily and weekly reports Heartbeat sends.
          </section>
        </TabsContent>
        <TabsContent value="trusts">
          <ul className="divide-y divide-border">
            {data.trusts.map((trust) => (
              <li key={trust.trustId} className="grid gap-1 py-3 text-sm sm:grid-cols-4">
                <span className="font-medium">{trust.trustName}</span>
                <span>{trust.recipients} recipients</span>
                <span className="tabular-nums">{rate(trust.openRate)} open</span>
                <span className="text-muted-foreground">
                  {trust.quiet} quiet · last open {when(trust.lastOpened)}
                </span>
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="recipients">
          <ul className="divide-y divide-border">
            {data.recipients.map((person) => (
              <RecipientRow
                key={`${person.trustId}-${person.email}`}
                person={person}
                canPause={role === 'admin'}
                onPause={() => void pause(person.recipientId)}
              />
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <ul className="divide-y divide-border">
            {data.reports.map((report) => (
              <li key={report.batchId}>
                <button
                  type="button"
                  onClick={() => setBatchId(report.batchId)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm"
                >
                  <span>
                    {report.trustName} · {report.reportType}
                    <span className="ml-2 text-muted-foreground">{when(report.sentAt)}</span>
                  </span>
                  <span className="tabular-nums">{rate(report.openRate)}</span>
                </button>
              </li>
            ))}
          </ul>
          {selected ? (
            <div className="rounded-lg ring-1 ring-border/70">
              <p className="border-b border-border px-4 py-2 text-sm font-medium">
                {selected.trustName} {selected.reportType}
              </p>
              <ul className="divide-y divide-border">
                {selected.opens.map((open) => (
                  <li key={open.email} className="flex justify-between px-4 py-2 text-sm">
                    <span>{open.email}</span>
                    <span className="text-muted-foreground">
                      {open.openedAt ? when(open.openedAt) : 'Not detected'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-white px-4 py-3 dark:bg-card">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function RecipientRow({
  person,
  canPause,
  onPause,
}: {
  person: EngagementPayload['recipients'][number]
  canPause: boolean
  onPause: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 text-sm">
      <span>
        <span className="font-medium">{person.name || person.email}</span>
        <span className="ml-2 text-muted-foreground">{person.trustName}</span>
        {person.quiet ? (
          <span className="ml-2 rounded bg-orange-500/15 px-1.5 py-0.5 text-xs text-orange-800 dark:text-orange-200">
            Quiet
          </span>
        ) : null}
        {!person.active ? <span className="ml-2 text-xs text-muted-foreground">Paused</span> : null}
      </span>
      <span className="flex items-center gap-3">
        <span className="tabular-nums text-muted-foreground">
          {person.opened}/{person.sent} · {rate(person.openRate)}
        </span>
        {canPause && person.active && person.recipientId ? (
          <Button variant="outline" size="sm" onClick={onPause}>
            Pause
          </Button>
        ) : null}
      </span>
    </li>
  )
}
