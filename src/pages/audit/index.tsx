import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { PageLoading } from '@/components/layout/PageLoading'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { dataTableCellClass, dataTableHeadClass } from '@/components/ui/data-table-utils'
import { useAuditLog } from '@/hooks/useAuditLog'
import { cn } from '@/lib/utils'

function actionBadge(action: string) {
  if (action === 'insert') return <Badge variant="success">insert</Badge>
  if (action === 'delete') return <Badge variant="destructive">delete</Badge>
  return <Badge variant="outline">{action}</Badge>
}

function summarize(entry: {
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}) {
  const after = entry.after
  const before = entry.before
  if (entry.action === 'insert' && after) {
    return String(after.name ?? after.display_name ?? after.email ?? after.slug ?? 'created')
  }
  if (entry.action === 'delete' && before) {
    return String(before.name ?? before.display_name ?? before.email ?? before.slug ?? 'deleted')
  }
  if (before && after) {
    const keys = Object.keys(after).filter((key) => {
      return JSON.stringify(before[key]) !== JSON.stringify(after[key])
    })
    if (!keys.length) return 'no field changes'
    return keys
      .slice(0, 4)
      .map((key) => `${key}: ${formatValue(before[key])} → ${formatValue(after[key])}`)
      .join(', ')
  }
  return '—'
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '∅'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function AuditPage() {
  const { entries, loading, error } = useAuditLog(150)

  if (loading) {
    return <PageLoading />
  }

  return (
    <div className="content-section content-section--full p-4 sm:p-6 lg:p-10">
      <div className="content-section__header">
        <h1 className="text-base font-normal">Audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable log of changes to trusts, vans, and recipients.
        </p>
      </div>
      <div className="content-section__content pt-6">
        {error ? (
          <PageEmptyState title="Could not load audit log" description={error} />
        ) : !entries.length ? (
          <PageEmptyState
            title="No audit entries yet"
            description="Changes to trusts, vans, and recipients will appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={dataTableHeadClass}>When</TableHead>
                  <TableHead className={dataTableHeadClass}>Action</TableHead>
                  <TableHead className={dataTableHeadClass}>Entity</TableHead>
                  <TableHead className={dataTableHeadClass}>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className={cn(dataTableCellClass, 'whitespace-nowrap text-xs')}>
                      {new Date(entry.at).toLocaleString()}
                    </TableCell>
                    <TableCell className={dataTableCellClass}>
                      {actionBadge(entry.action)}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'font-mono text-xs')}>
                      {entry.entity}
                      {entry.entity_id ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {entry.entity_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className={cn(dataTableCellClass, 'max-w-md truncate text-sm')}>
                      {summarize(entry)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
