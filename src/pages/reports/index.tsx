import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { dataTableCellClass, dataTableHeadClass } from '@/components/ui/data-table-utils'
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

function statusBadge(status: VanStatus) {
  if (status === 'active') return <Badge variant="success">Active</Badge>
  if (status === 'paused') return <Badge variant="warning">Paused</Badge>
  if (status === 'unassigned') return <Badge variant="outline">Unassigned</Badge>
  return <Badge variant="secondary">Removed</Badge>
}

export function ReportsPage() {
  const { role } = useAuth()
  const canWrite = role === 'admin'
  const { trusts, unassigned, loading, error, reload } = useReportConfig()
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
      <div className="content-section__header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-normal">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trusts, vans, daily/weekly toggles, and email recipients.
          </p>
        </div>
        {canWrite ? (
          <Button size="sm" onClick={() => setAddTrustOpen(true)}>
            <Plus className="size-4" />
            Add trust
          </Button>
        ) : null}
      </div>

      <div className="content-section__content pt-6">
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
          <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <TrustList
              trusts={trusts}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
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
          <section className="mt-10">
            <h2 className="text-sm font-medium">Unassigned vans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Auto-discovered from Grafana. Assign to a trust to include in reports.
            </p>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={dataTableHeadClass}>Instance</TableHead>
                    <TableHead className={dataTableHeadClass}>Display name</TableHead>
                    <TableHead className={dataTableHeadClass}>Status</TableHead>
                    {canWrite ? (
                      <TableHead className={dataTableHeadClass} />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unassigned.map((van) => (
                    <TableRow key={van.id}>
                      <TableCell className={cn(dataTableCellClass, 'font-mono text-xs')}>
                        {van.instance}
                      </TableCell>
                      <TableCell className={dataTableCellClass}>{van.display_name}</TableCell>
                      <TableCell className={dataTableCellClass}>
                        {statusBadge(van.status)}
                      </TableCell>
                      {canWrite ? (
                        <TableCell className={dataTableCellClass}>
                          <div className="flex justify-end gap-2">
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
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    <nav className="flex flex-col gap-1">
      {trusts.map((trust) => {
        const active = trust.id === selectedId
        return (
          <button
            key={trust.id}
            type="button"
            onClick={() => onSelect(trust.id)}
            className={cn(
              'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
              active
                ? 'bg-sidebar-accent font-medium text-primary'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <span className="truncate">{trust.name}</span>
            {!trust.active ? <Badge variant="secondary">Off</Badge> : null}
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
  const recipients = trust.recipients.filter((recipient) => recipient.active)
  const removedRecipients = trust.recipients.filter((recipient) => !recipient.active)

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{trust.name}</h2>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{trust.slug}</p>
        </div>
        {canWrite ? (
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
            {trust.active ? 'Deactivate trust' : 'Activate trust'}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-6">
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

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Vans</h3>
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={onAddVan}>
              <Plus className="size-4" />
              Add van
            </Button>
          ) : null}
        </div>
        {!vans.length ? (
          <p className="text-sm text-muted-foreground">No vans for this trust.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={dataTableHeadClass}>Name</TableHead>
                  <TableHead className={dataTableHeadClass}>Instance</TableHead>
                  <TableHead className={dataTableHeadClass}>Daily</TableHead>
                  <TableHead className={dataTableHeadClass}>Weekly</TableHead>
                  <TableHead className={dataTableHeadClass}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vans.map((van) => (
                  <VanRow
                    key={van.id}
                    van={van}
                    canWrite={canWrite}
                    onReload={onReload}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Recipients</h3>
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={onAddRecipient}>
              <Plus className="size-4" />
              Add recipient
            </Button>
          ) : null}
        </div>
        {!recipients.length ? (
          <p className="text-sm text-muted-foreground">No active recipients.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={dataTableHeadClass}>Name</TableHead>
                  <TableHead className={dataTableHeadClass}>Email</TableHead>
                  <TableHead className={dataTableHeadClass} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.map((recipient) => (
                  <RecipientRow
                    key={recipient.id}
                    recipient={recipient}
                    canWrite={canWrite}
                    onReload={onReload}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {removedRecipients.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {removedRecipients.length} inactive recipient
            {removedRecipients.length === 1 ? '' : 's'} hidden (soft-deleted).
          </p>
        ) : null}
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
    <TableRow>
      <TableCell className={dataTableCellClass}>{van.display_name}</TableCell>
      <TableCell className={cn(dataTableCellClass, 'font-mono text-xs')}>
        {van.instance}
      </TableCell>
      <TableCell className={dataTableCellClass}>
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
      </TableCell>
      <TableCell className={dataTableCellClass}>
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
      </TableCell>
      <TableCell className={dataTableCellClass}>
        {canWrite ? (
          <div className="w-[140px]">
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
          </div>
        ) : (
          statusBadge(van.status)
        )}
      </TableCell>
    </TableRow>
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
    <TableRow>
      <TableCell className={dataTableCellClass}>{recipient.name}</TableCell>
      <TableCell className={dataTableCellClass}>{recipient.email}</TableCell>
      <TableCell className={cn(dataTableCellClass, 'text-right')}>
        {canWrite ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void runMutation(
                'Recipient deactivated',
                () =>
                  supabase
                    .from('recipients')
                    .update({ active: false })
                    .eq('id', recipient.id),
                onReload,
              )
            }}
          >
            Remove
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
      <span>{label}</span>
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
