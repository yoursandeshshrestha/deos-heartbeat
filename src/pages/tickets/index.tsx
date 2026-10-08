import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import useSWR from 'swr'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { SupportTicket, TicketsPayload } from '@/lib/addon-types'
import { serverFetch } from '@/lib/serverApi'
import { cn } from '@/lib/utils'
import { vanPath } from '@/lib/van-path'
import { useAuth } from '@/lib/auth'

const STATUSES = [
  { label: 'Open and pending', value: 'open' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All tickets', value: 'all' },
]

const overviewCardClass = 'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'
const overviewHeaderClass =
  'flex flex-wrap items-center justify-between gap-3 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'
const joinedCellClass =
  'relative flex min-h-0 w-full flex-col overflow-hidden bg-white text-left dark:bg-card'

const fetcher = async (url: string): Promise<TicketsPayload> => {
  const response = await serverFetch(url)
  if (!response.ok) throw new Error(`Tickets API ${response.status}`)
  return response.json()
}

function when(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}

function trustLabel(slug: string) {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function StatCell({ title, value, detail }: { title: string; value: ReactNode; detail: ReactNode }) {
  return (
    <div className={cn(joinedCellClass, 'gap-1.5 px-4 py-3.5')}>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
      <div className="text-sm leading-snug text-muted-foreground">{detail}</div>
    </div>
  )
}

export function TicketsPage() {
  const { role } = useAuth()
  const [status, setStatus] = useState('open')
  const [trust, setTrust] = useState('all')
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [linkInstance, setLinkInstance] = useState('unassigned')
  const params = new URLSearchParams({ status })
  if (trust !== 'all') params.set('trust', trust)
  const { data, error, isLoading, mutate } = useSWR<TicketsPayload>(`/api/tickets?${params}`, fetcher, {
    keepPreviousData: true,
  })

  const trustOptions = useMemo(() => {
    const slugs = new Set((data?.tickets ?? []).map((ticket) => ticket.trust_slug).filter(Boolean) as string[])
    for (const van of data?.vans ?? []) {
      if (van.trust_slug) slugs.add(van.trust_slug)
    }
    return [
      { label: 'All trusts', value: 'all' },
      ...[...slugs].sort().map((slug) => ({ label: trustLabel(slug), value: slug })),
    ]
  }, [data])

  const vanOptions = useMemo(
    () =>
      (data?.vans ?? []).map((van) => ({
        label: `${van.display_name} (${van.instance})`,
        value: van.instance,
      })),
    [data],
  )

  async function linkTicket() {
    if (!selected) return
    const response = await serverFetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        instance: linkInstance === 'unassigned' ? null : linkInstance,
      }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      toast.error(body?.error ?? 'Could not link ticket')
      return
    }
    toast.success(linkInstance === 'unassigned' ? 'Ticket unassigned' : 'Ticket linked')
    setSelected(null)
    void mutate()
  }

  if (isLoading && !data) return <PageLoading />
  if (error && !data) {
    return (
      <div className="p-6">
        <PageEmptyState title="Tickets unavailable" description="The ticket list could not be loaded." />
      </div>
    )
  }
  if (!data) return null

  const empty = data.configured
    ? 'Nothing matches this filter.'
    : 'Tickets are not connected yet. They will show here once Freshdesk is linked.'

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__content space-y-6">
        <section aria-label="Ticket counts" className={overviewCardClass}>
          <div className={overviewHeaderClass}>
            <span>Overview</span>
          </div>
          <div className="grid gap-px bg-border/70 sm:grid-cols-3">
            <StatCell
              title="Open"
              value={String(data.counts.open)}
              detail={data.counts.open ? 'Waiting for a reply' : 'None right now'}
            />
            <StatCell
              title="Pending"
              value={String(data.counts.pending)}
              detail={data.counts.pending ? 'Waiting on someone else' : 'None right now'}
            />
            <StatCell
              title="Urgent"
              value={String(data.counts.urgent)}
              detail={data.counts.urgent ? 'Open or pending' : 'None right now'}
            />
          </div>
        </section>

        <section className={overviewCardClass}>
          <div className={overviewHeaderClass}>
            <span>Tickets</span>
            <div className="flex w-full gap-2 sm:w-auto">
              <div className="min-w-0 flex-1 sm:w-48">
                <Combobox data={trustOptions} type="trust" value={trust} onValueChange={setTrust}>
                  <ComboboxTrigger className="w-full" />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxList>
                      <ComboboxEmpty>No trust found</ComboboxEmpty>
                      <ComboboxGroup>
                        {trustOptions.map((option) => (
                          <ComboboxItem key={option.value} value={option.value}>
                            {option.label}
                          </ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="min-w-0 flex-1 sm:w-48">
                <Combobox data={STATUSES} type="status" value={status} onValueChange={setStatus}>
                  <ComboboxTrigger className="w-full" />
                  <ComboboxContent>
                    <ComboboxInput />
                    <ComboboxList>
                      <ComboboxEmpty>No status found</ComboboxEmpty>
                      <ComboboxGroup>
                        {STATUSES.map((option) => (
                          <ComboboxItem key={option.value} value={option.value}>
                            {option.label}
                          </ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
          </div>
          <p className="px-4 py-3 text-sm text-muted-foreground">
            View only. Replies and updates stay in Freshdesk. The list refreshes every 15 minutes.
            {data.configured && data.notice ? ' The latest refresh did not complete.' : ''}
          </p>
          {data.tickets.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Trust</th>
                    <th>Van</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(ticket)
                            setLinkInstance(ticket.instance ?? 'unassigned')
                          }}
                          className="py-3 text-left font-medium hover:underline"
                        >
                          {ticket.subject}
                        </button>
                      </td>
                      <td className="text-muted-foreground">
                        {ticket.trust_slug ? trustLabel(ticket.trust_slug) : 'Unassigned'}
                      </td>
                      <td className="text-muted-foreground">
                        {ticket.instance ? (
                          <Link to={vanPath(ticket.instance)} className="hover:text-foreground hover:underline">
                            {ticket.instance}
                          </Link>
                        ) : (
                          'Not linked'
                        )}
                      </td>
                      <td className="capitalize text-muted-foreground">{ticket.priority}</td>
                      <td className="capitalize text-muted-foreground">{ticket.status}</td>
                      <td className="text-muted-foreground">{when(ticket.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border-t border-border px-4 py-8 text-sm text-muted-foreground">{empty}</p>
          )}
        </section>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.subject}</SheetTitle>
                <SheetDescription>Ticket {selected.id}</SheetDescription>
              </SheetHeader>
              <dl className="space-y-2 px-4 text-sm">
                <Row label="Status" value={selected.status} />
                <Row label="Priority" value={selected.priority} />
                <Row label="Requester" value={selected.requester} />
                <Row label="Source" value={selected.source} />
                <Row label="Assignee" value={selected.assignee} />
                <Row label="Created" value={when(selected.created_at)} />
                <Row label="Updated" value={when(selected.updated_at)} />
              </dl>
              <div className="mt-4 flex flex-col gap-3 px-4">
                {selected.url ? (
                  <a href={selected.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline">
                    Open in Freshdesk
                  </a>
                ) : null}
                {selected.instance ? (
                  <Link to={vanPath(selected.instance)} className="text-sm font-medium underline">
                    View van
                  </Link>
                ) : null}
                {role === 'admin' ? (
                  <div className="space-y-2">
                    <Combobox
                      data={[{ label: 'Unassigned', value: 'unassigned' }, ...vanOptions]}
                      type="van"
                      value={linkInstance}
                      onValueChange={setLinkInstance}
                    >
                      <ComboboxTrigger className="w-full" />
                      <ComboboxContent>
                        <ComboboxInput />
                        <ComboboxList>
                          <ComboboxEmpty>No van found</ComboboxEmpty>
                          <ComboboxGroup>
                            <ComboboxItem value="unassigned">Unassigned</ComboboxItem>
                            {vanOptions.map((option) => (
                              <ComboboxItem key={option.value} value={option.value}>
                                {option.label}
                              </ComboboxItem>
                            ))}
                          </ComboboxGroup>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <Button size="sm" onClick={() => void linkTicket()}>
                      Save van link
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="capitalize text-right">{value || '—'}</dd>
    </div>
  )
}
