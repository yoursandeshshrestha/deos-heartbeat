import useSWR from 'swr'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

type BriefingResponse = {
  summary: string
  cached?: boolean
}

async function fetcher(url: string): Promise<BriefingResponse> {
  const response = await fetch(url)
  const payload = (await response.json()) as BriefingResponse & {
    error?: string
  }
  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not load briefing')
  }
  if (typeof payload.summary !== 'string' || !payload.summary.trim()) {
    throw new Error('Briefing response missing summary text')
  }
  return payload
}

export function FleetBriefing({
  trustFilter,
  className,
}: {
  trustFilter: string
  className?: string
}) {
  const { fullName } = useAuth()
  const trust = trustFilter || 'all'
  const name = fullName?.trim() || ''
  const { data, error, isLoading } = useSWR(
    `/api/fleet-summary?trust=${encodeURIComponent(trust)}&name=${encodeURIComponent(name)}`,
    fetcher,
    {
      refreshInterval: 3 * 60_000,
      revalidateOnFocus: false,
    },
  )

  return (
    <section
      aria-label="Today's summary"
      className={cn(
        'overflow-hidden bg-white shadow-xs ring-1 ring-border/70 dark:bg-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 bg-muted/50 px-4 py-3 text-base font-medium text-muted-foreground">
        <span>Today&apos;s summary</span>
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        {isLoading && !data ? (
          <div className="space-y-2">
            <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
            <div className="h-4 w-10/12 animate-pulse rounded bg-muted" />
            <div className="h-4 w-8/12 animate-pulse rounded bg-muted" />
          </div>
        ) : error && !data ? (
          <p className="text-base leading-relaxed text-muted-foreground">
            Summary is temporarily unavailable. The numbers below are still live.
          </p>
        ) : (
          <p className="text-base leading-relaxed text-foreground sm:text-[17px] sm:leading-7">
            {data?.summary}
          </p>
        )}
      </div>
    </section>
  )
}
