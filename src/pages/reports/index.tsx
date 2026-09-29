import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { runMutation, useReportConfig } from '@/hooks/useReportConfig'
import { useAuth } from '@/lib/auth'
import {
  slugify,
  type Recipient,
  type TrustWithRelations,
  type Van,
  type VanStatus,
} from '@/lib/heartbeat-types'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const VAN_STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Unassigned', value: 'unassigned' },
  { label: 'Removed', value: 'removed' },
]

const overviewCardClass =
  'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card'

const overviewHeaderClass =
  'flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground'

function statusBadge(status: VanStatus) {
  if (status === 'active') return <Badge variant="success">Active</Badge>
  if (status === 'paused') return <Badge variant="warning">Paused</Badge>
  if (status === 'unassigned') return <Badge variant="outline">Unassigned</Badge>
  return <Badge variant="secondary">Removed</Badge>
}

type PdfSettings = {
  studies: boolean
  transfer_speed: boolean
  modality_window: boolean
  week_total: boolean
}

const DEFAULT_PDF_SETTINGS: PdfSettings = {
  studies: true,
  transfer_speed: true,
  modality_window: true,
  week_total: true,
}

const PDF_FIELDS: Array<{ key: keyof PdfSettings; label: string; hint: string }> = [
  {
    key: 'studies',
    label: 'Total studies transferred',
    hint: 'Daily cards and the weekly table',
  },
  {
    key: 'transfer_speed',
    label: 'Average transfer speed',
    hint: 'Daily cards and the weekly table',
  },
  {
    key: 'modality_window',
    label: 'Modality connection times',
    hint: 'Start and end for each day',
  },
  {
    key: 'week_total',
    label: 'Weekly studies total',
    hint: 'Shown on the weekly PDF only',
  },
]

function readPdfSettings(value: unknown): PdfSettings {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const settings = { ...DEFAULT_PDF_SETTINGS }
  for (const field of PDF_FIELDS) {
    const next = source[field.key]
    if (typeof next === 'boolean') settings[field.key] = next
  }
  return settings
}

export function ReportsPage() {
  const { role } = useAuth()
  const canWrite = role === 'admin'
  const { trusts, unassigned, loading, error, reload } = useReportConfig()
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>(DEFAULT_PDF_SETTINGS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('settings')
      .select('value')
      .eq('key', 'report_pdf')
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled || loadError || !data) return
        setPdfSettings(readPdfSettings(data.value))
      })
    return () => {
      cancelled = true
    }
  }, [])
  const [addTrustOpen, setAddTrustOpen] = useState(false)
  const [addVanOpen, setAddVanOpen] = useState(false)
  const [addRecipientOpen, setAddRecipientOpen] = useState(false)
  const [assignVan, setAssignVan] = useState<Van | null>(null)

  const selected = useMemo(() => {
    if (!trusts.length) return null
    return trusts.find((trust) => trust.id === selectedId) ?? trusts[0]
  }, [trusts, selectedId])

  const trustOptions = useMemo(
    () =>
      trusts
        .filter((trust) => trust.active)
        .map((trust) => ({ label: trust.name, value: trust.id })),
    [trusts],
  )

  if (loading) {
    return <PageLoading />
  }

  if (error) {
    return (
      <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
        <PageEmptyState title="Could not load report config" description={error} />
      </div>
    )
  }

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__header flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Configure trusts, vans, and recipients. Daily and weekly emails include a
          performance PDF. Stored copies are on{' '}
          <Link to="/report-history" className="text-foreground underline underline-offset-2">
            Report history
          </Link>
          .
        </p>
        {canWrite ? (
          <Button size="sm" onClick={() => setAddTrustOpen(true)}>
            <Plus className="size-4" />
            Add trust
          </Button>
        ) : null}
      </div>

      <div className="content-section__content space-y-6 pt-6">
        <PdfContentsCard canWrite={canWrite} settings={pdfSettings} onChange={setPdfSettings} />
        {!trusts.length ? (
          <PageEmptyState
            title="No trusts yet"
            description={
              canWrite
                ? 'Add a trust to start configuring vans and recipients.'
                : 'Ask an admin to configure trusts.'
            }
            action={
              canWrite ? (
                <Button size="sm" onClick={() => setAddTrustOpen(true)}>
                  Add trust
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <section className={overviewCardClass}>
              <div className={overviewHeaderClass}>
                <span>Trusts</span>
                <span className="text-sm tabular-nums">{trusts.length}</span>
              </div>
              <TrustList
                trusts={trusts}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
            </section>

            {selected ? (
              <TrustDetail
                trust={selected}
                canWrite={canWrite}
                onReload={reload}
                onAddVan={() => setAddVanOpen(true)}
                onAddRecipient={() => setAddRecipientOpen(true)}
              />
            ) : null}
          </div>
        )}

        {unassigned.length > 0 ? (
          <section className={overviewCardClass}>
            <div className={overviewHeaderClass}>
              <span>Unassigned vans</span>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {unassigned.length}
                </span>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void (async () => {
                        const slugToId = new Map(
                          trusts.map((trust) => [trust.slug, trust.id] as const),
                        )
                        let ok = 0
                        let skipped = 0
                        for (const van of unassigned) {
                          const slug = van.instance.split('.')[0] ?? ''
                          const trustId = van.trust_id ?? slugToId.get(slug)
                          if (!trustId) {
                            skipped += 1
                            continue
                          }
                          const { error } = await supabase
                            .from('vans')
                            .update({
                              trust_id: trustId,
                              status: 'active',
                              daily_enabled: true,
                              weekly_enabled: true,
                            })
                            .eq('id', van.id)
                          if (error) {
                            toast.error(`${van.instance}: ${error.message}`)
                            await reload()
                            return
                          }
                          ok += 1
                        }
                        toast.success(
                          `Activated ${ok} van${ok === 1 ? '' : 's'}${
                            skipped ? ` (${skipped} need a trust first)` : ''
                          }`,
                        )
                        await reload()
                      })()
                    }}
                  >
                    Activate all suggested
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="px-4 pb-1 pt-3.5">
              <p className="mb-3 text-sm text-muted-foreground">
                Auto-discovered from Grafana. Assign to a trust to include in reports.
              </p>
              <div className="-mx-4 divide-y divide-border">
                {unassigned.map((van) => (
                  <div
                    key={van.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {van.display_name}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {van.instance}
                      </div>
                    </div>
                    {statusBadge(van.status)}
                    {canWrite ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssignVan(van)}
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void runMutation(
                              'Van dismissed',
                              () =>
                                supabase
                                  .from('vans')
                                  .update({ status: 'removed' })
                                  .eq('id', van.id),
                              reload,
                            )
                          }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <AddTrustDialog
        open={addTrustOpen}
        onOpenChange={setAddTrustOpen}
        onCreated={async (id) => {
          await reload()
          setSelectedId(id)
        }}
      />
      <AssignVanDialog
        van={assignVan}
        trustOptions={trustOptions}
        trusts={trusts}
        open={assignVan != null}
        onOpenChange={(open) => {
          if (!open) setAssignVan(null)
        }}
        onAssigned={async (trustId) => {
          await reload()
          setSelectedId(trustId)
          setAssignVan(null)
        }}
      />
      {selected ? (
        <>
          <AddVanDialog
            open={addVanOpen}
            onOpenChange={setAddVanOpen}
            trustId={selected.id}
            onCreated={reload}
          />
          <AddRecipientDialog
            open={addRecipientOpen}
            onOpenChange={setAddRecipientOpen}
            trustId={selected.id}
            onCreated={reload}
          />
        </>
      ) : null}
    </div>
  )
}

function TrustList({
  trusts,
  selectedId,
  onSelect,
}: {
  trusts: TrustWithRelations[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <nav className="divide-y divide-border">
      {trusts.map((trust) => {
        const active = trust.id === selectedId
        const vanCount = trust.vans.filter((van) => van.status !== 'removed').length
        return (
          <button
            key={trust.id}
            type="button"
            onClick={() => onSelect(trust.id)}
            className={cn(
              'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
              active ? 'bg-[#f3f3f3] dark:bg-muted' : 'hover:bg-muted/50',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'truncate text-sm',
                  active ? 'font-medium text-foreground' : 'text-foreground',
                )}
              >
                {trust.name}
              </span>
              {!trust.active ? <Badge variant="secondary">Off</Badge> : null}
            </div>
            <div className="text-xs tabular-nums text-muted-foreground">
              {vanCount} van{vanCount === 1 ? '' : 's'}
            </div>
          </button>
        )
      })}
    </nav>
  )
}

function TrustDetail({
  trust,
  canWrite,
  onReload,
  onAddVan,
  onAddRecipient,
}: {
  trust: TrustWithRelations
  canWrite: boolean
  onReload: () => Promise<void>
  onAddVan: () => void
  onAddRecipient: () => void
}) {
  const vans = trust.vans.filter((van) => van.status !== 'removed')
  const recipients = [...trust.recipients].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  const activeRecipientCount = recipients.filter((r) => r.active).length
  const [sendingTest, setSendingTest] = useState(false)

  async function sendTestReport() {
    setSendingTest(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        toast.error('Not signed in')
        return
      }
      const response = await fetch('/api/reports/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_type: 'daily',
          trust_id: trust.id,
        }),
      })
      const payload = (await response.json()) as {
        error?: string
        sent?: number
        failed?: number
        skipped?: number
        results?: Array<{ status: string; reason?: string }>
      }
      if (!response.ok) {
        toast.error(payload.error ?? 'Send failed')
        return
      }
      if ((payload.sent ?? 0) > 0) {
        toast.success(
          `Test report sent to ${activeRecipientCount} recipient${activeRecipientCount === 1 ? '' : 's'}`,
        )
        return
      }
      const reason = payload.results?.[0]?.reason ?? 'skipped'
      if ((payload.failed ?? 0) > 0) {
        toast.error(`Send failed: ${reason}`)
        return
      }
      toast.message(`Report not sent: ${reason}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Send failed')
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className={overviewCardClass}>
        <div className={overviewHeaderClass}>
          <span className="truncate text-foreground">{trust.name}</span>
          {canWrite ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                loading={sendingTest}
                disabled={!activeRecipientCount}
                onClick={() => {
                  void sendTestReport()
                }}
              >
                Send test report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void runMutation(
                    trust.active ? 'Trust deactivated' : 'Trust activated',
                    () =>
                      supabase
                        .from('trusts')
                        .update({ active: !trust.active })
                        .eq('id', trust.id),
                    onReload,
                  )
                }}
              >
                {trust.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-px bg-border/70 sm:grid-cols-2">
          <ToggleRow
            label="Daily reports"
            checked={trust.daily_enabled}
            disabled={!canWrite}
            onChange={(checked) => {
              void runMutation(
                'Daily toggle updated',
                () =>
                  supabase
                    .from('trusts')
                    .update({ daily_enabled: checked })
                    .eq('id', trust.id),
                onReload,
              )
            }}
          />
          <ToggleRow
            label="Weekly reports"
            checked={trust.weekly_enabled}
            disabled={!canWrite}
            onChange={(checked) => {
              void runMutation(
                'Weekly toggle updated',
                () =>
                  supabase
                    .from('trusts')
                    .update({ weekly_enabled: checked })
                    .eq('id', trust.id),
                onReload,
              )
            }}
          />
        </div>
      </section>

      <section className={overviewCardClass}>
        <div className={overviewHeaderClass}>
          <span>
            Vans{' '}
            <span className="text-sm tabular-nums text-muted-foreground">
              {vans.length}
            </span>
          </span>
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={onAddVan}>
              <Plus className="size-4" />
              Add van
            </Button>
          ) : null}
        </div>
        {!vans.length ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No vans for this trust.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] px-4 pb-1 pt-3.5">
              <header className="grid grid-cols-[minmax(120px,1.2fr)_minmax(140px,1.4fr)_70px_70px_140px] gap-3 text-sm font-medium text-muted-foreground">
                <span>Name</span>
                <span>Instance</span>
                <span>Daily</span>
                <span>Weekly</span>
                <span>Status</span>
              </header>
              <div className="-mx-4 mt-1 divide-y divide-border">
                {vans.map((van) => (
                  <VanRow
                    key={van.id}
                    van={van}
                    canWrite={canWrite}
                    onReload={onReload}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={overviewCardClass}>
        <div className={overviewHeaderClass}>
          <span>
            Recipients{' '}
            <span className="text-sm tabular-nums text-muted-foreground">
              {activeRecipientCount}/{recipients.length}
            </span>
          </span>
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={onAddRecipient}>
              <Plus className="size-4" />
              Add recipient
            </Button>
          ) : null}
        </div>
        {!recipients.length ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No recipients yet. Add emails so daily/weekly reports have somewhere to go.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recipients.map((recipient) => (
              <RecipientRow
                key={recipient.id}
                recipient={recipient}
                canWrite={canWrite}
                onReload={onReload}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function VanRow({
  van,
  canWrite,
  onReload,
}: {
  van: Van
  canWrite: boolean
  onReload: () => Promise<void>
}) {
  return (
    <div className="grid grid-cols-[minmax(120px,1.2fr)_minmax(140px,1.4fr)_70px_70px_140px] items-center gap-3 px-4 py-3 text-sm">
      <span className="truncate font-medium">{van.display_name}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">
        {van.instance}
      </span>
      <div>
        <Switch
          size="sm"
          checked={van.daily_enabled}
          disabled={!canWrite}
          onCheckedChange={(checked) => {
            void runMutation(
              'Van daily toggle updated',
              () =>
                supabase
                  .from('vans')
                  .update({ daily_enabled: checked })
                  .eq('id', van.id),
              onReload,
            )
          }}
        />
      </div>
      <div>
        <Switch
          size="sm"
          checked={van.weekly_enabled}
          disabled={!canWrite}
          onCheckedChange={(checked) => {
            void runMutation(
              'Van weekly toggle updated',
              () =>
                supabase
                  .from('vans')
                  .update({ weekly_enabled: checked })
                  .eq('id', van.id),
              onReload,
            )
          }}
        />
      </div>
      <div>
        {canWrite ? (
          <Combobox
            data={VAN_STATUS_OPTIONS}
            type="status"
            value={van.status}
            onValueChange={(value) => {
              void runMutation(
                'Van status updated',
                () =>
                  supabase
                    .from('vans')
                    .update({ status: value as VanStatus })
                    .eq('id', van.id),
                onReload,
              )
            }}
          >
            <ComboboxTrigger className="w-full" />
            <ComboboxContent>
              <ComboboxInput />
              <ComboboxList>
                <ComboboxEmpty>No status found</ComboboxEmpty>
                <ComboboxGroup>
                  {VAN_STATUS_OPTIONS.map((option) => (
                    <ComboboxItem key={option.value} value={option.value}>
                      {option.label}
                    </ComboboxItem>
                  ))}
                </ComboboxGroup>
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        ) : (
          statusBadge(van.status)
        )}
      </div>
    </div>
  )
}

function RecipientRow({
  recipient,
  canWrite,
  onReload,
}: {
  recipient: Recipient
  canWrite: boolean
  onReload: () => Promise<void>
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{recipient.name}</div>
        <div className="truncate text-sm text-muted-foreground">{recipient.email}</div>
      </div>
      <Switch
        size="sm"
        checked={recipient.active}
        disabled={!canWrite}
        onCheckedChange={(checked) => {
          void runMutation(
            checked ? 'Recipient activated' : 'Recipient deactivated',
            () =>
              supabase
                .from('recipients')
                .update({ active: checked })
                .eq('id', recipient.id),
            onReload,
          )
        }}
      />
    </div>
  )
}

function PdfContentsCard({
  canWrite,
  settings,
  onChange,
}: {
  canWrite: boolean
  settings: PdfSettings
  onChange: (settings: PdfSettings) => void
}) {
  async function toggle(key: keyof PdfSettings, checked: boolean) {
    const next = { ...settings, [key]: checked }
    const anyOn = PDF_FIELDS.some((field) => next[field.key])
    if (!anyOn) {
      toast.message('Keep at least one figure in the PDF')
      return
    }
    const previous = settings
    onChange(next)
    const { error } = await supabase.from('settings').upsert(
      {
        key: 'report_pdf',
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    if (error) {
      onChange(previous)
      toast.error(error.message)
      return
    }
    toast.success('PDF contents updated')
  }

  return (
    <section className={overviewCardClass}>
      <div className={overviewHeaderClass}>
        <span>PDF contents</span>
      </div>
      <p className="px-4 pt-3 text-sm text-muted-foreground">
        Choose which figures go into the daily and weekly PDFs. This applies to
        every trust.
      </p>
      <div className="grid gap-px bg-border/70 sm:grid-cols-2">
        {PDF_FIELDS.map((field) => (
          <ToggleRow
            key={field.key}
            label={field.label}
            hint={field.hint}
            checked={settings[field.key]}
            disabled={!canWrite}
            onChange={(checked) => {
              void toggle(field.key, checked)
            }}
          />
        ))}
      </div>
    </section>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 bg-white px-4 py-3.5 text-sm dark:bg-card">
      <span>
        <span className="text-muted-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground/80">{hint}</span>
        ) : null}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

function AssignVanDialog({
  van,
  trustOptions,
  trusts,
  open,
  onOpenChange,
  onAssigned,
}: {
  van: Van | null
  trustOptions: { label: string; value: string }[]
  trusts: TrustWithRelations[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned: (trustId: string) => Promise<void>
}) {
  const suggestedTrustId = useMemo(() => {
    if (!van) return ''
    if (van.trust_id) return van.trust_id
    const slug = van.instance.split('.')[0] ?? ''
    return trusts.find((trust) => trust.slug === slug)?.id ?? ''
  }, [van, trusts])

  const [trustId, setTrustId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setTrustId(suggestedTrustId)
  }, [open, suggestedTrustId])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!van || !trustId) {
      toast.error('Pick a trust')
      return
    }
    setSubmitting(true)
    const { error } = await supabase
      .from('vans')
      .update({
        trust_id: trustId,
        status: 'active',
        daily_enabled: true,
        weekly_enabled: true,
        display_name:
          van.display_name === van.instance
            ? van.instance.split('.').slice(1).join('.').replace(/_/g, ' ') ||
              van.display_name
            : van.display_name,
        modality_target: van.modality_target ?? van.instance,
      })
      .eq('id', van.id)
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Van assigned')
    onOpenChange(false)
    await onAssigned(trustId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Assign van</DialogTitle>
            <DialogDescription>
              {van
                ? `Link ${van.instance} to a trust and mark it active for reports.`
                : 'Link a discovered van to a trust.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Trust</Label>
              <Combobox
                data={trustOptions}
                type="trust"
                value={trustId}
                onValueChange={setTrustId}
              >
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
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} data-dialog-primary-action>
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddTrustDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextSlug = slug || slugify(name)
    if (!name.trim() || !nextSlug) {
      toast.error('Name and slug are required')
      return
    }
    setSubmitting(true)
    const { data, error } = await supabase
      .from('trusts')
      .insert({
        name: name.trim(),
        slug: nextSlug,
        active: true,
        daily_enabled: true,
        weekly_enabled: true,
      })
      .select('id')
      .single()
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Trust created')
    onOpenChange(false)
    setName('')
    setSlug('')
    await onCreated(data.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add trust</DialogTitle>
            <DialogDescription>
              Soft-deletes keep history; deactivate later instead of deleting.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trust-name">Name</Label>
              <Input
                id="trust-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (!slug || slug === slugify(name)) {
                    setSlug(slugify(event.target.value))
                  }
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trust-slug">Slug</Label>
              <Input
                id="trust-slug"
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                required
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} data-dialog-primary-action>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddVanDialog({
  open,
  onOpenChange,
  trustId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trustId: string
  onCreated: () => Promise<void>
}) {
  const [displayName, setDisplayName] = useState('')
  const [instance, setInstance] = useState('')
  const [modalityTarget, setModalityTarget] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from('vans').insert({
      trust_id: trustId,
      display_name: displayName.trim(),
      instance: instance.trim(),
      modality_target: modalityTarget.trim() || null,
      status: 'active',
      daily_enabled: true,
      weekly_enabled: true,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Van created')
    onOpenChange(false)
    setDisplayName('')
    setInstance('')
    setModalityTarget('')
    await onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add van</DialogTitle>
            <DialogDescription>
              Instance must match the Prometheus label (e.g. bradford.van3-ingleborough).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="van-name">Display name</Label>
              <Input
                id="van-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="van-instance">Instance</Label>
              <Input
                id="van-instance"
                value={instance}
                onChange={(event) => setInstance(event.target.value)}
                required
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="van-modality">Modality target (optional)</Label>
              <Input
                id="van-modality"
                value={modalityTarget}
                onChange={(event) => setModalityTarget(event.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} data-dialog-primary-action>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddRecipientDialog({
  open,
  onOpenChange,
  trustId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trustId: string
  onCreated: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from('recipients').insert({
      trust_id: trustId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      active: true,
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Recipient added')
    onOpenChange(false)
    setName('')
    setEmail('')
    await onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add recipient</DialogTitle>
            <DialogDescription>Email addresses for daily/weekly report delivery.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Name</Label>
              <Input
                id="recipient-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient-email">Email</Label>
              <Input
                id="recipient-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} data-dialog-primary-action>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
