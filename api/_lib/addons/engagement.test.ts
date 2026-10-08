import { describe, expect, it } from 'vitest'
import { buildEngagement, type DeliveryRow } from './engagement'
import { matchTicketVan, ticketSearchText } from './tickets'

const vans = [
  { instance: 'bradford.van1', display_name: 'Ingleborough', trust_slug: 'bradford' },
  { instance: 'bradford.van10', display_name: 'Pen-y-ghent', trust_slug: 'bradford' },
]

describe('ticket matching', () => {
  it('prefers the longer instance name and leaves unnamed tickets unassigned', () => {
    const named = matchTicketVan('Modem down on bradford.van10', vans)
    expect(named?.instance).toBe('bradford.van10')
    expect(matchTicketVan('Someone called about a van', vans)).toBeNull()
    const fromFields = matchTicketVan(
      ticketSearchText({
        subject: 'No sync',
        custom_fields: { van: 'Ingleborough' },
        tags: ['jo'],
      }),
      vans,
    )
    expect(fromFields?.instance).toBe('bradford.van1')
  })
})

function delivery(partial: Partial<DeliveryRow> & Pick<DeliveryRow, 'email' | 'sent_at'>): DeliveryRow {
  return {
    id: partial.email + partial.sent_at,
    trust_id: 't1',
    trust_name: 'Acme',
    recipient_id: 'r1',
    recipient_name: 'Ada',
    active: true,
    report_type: 'daily',
    batch_id: 'b1',
    resend_id: 're_1',
    opened_at: null,
    ...partial,
  }
}

describe('engagement', () => {
  it('flags a recipient with no detected open in four weeks', () => {
    const now = new Date('2026-10-06T12:00:00.000Z')
    const view = buildEngagement(
      [
        delivery({
          email: 'quiet@nhs.net',
          sent_at: '2026-10-05T08:00:00.000Z',
          opened_at: null,
        }),
        delivery({
          email: 'active@nhs.net',
          sent_at: '2026-10-05T08:00:00.000Z',
          opened_at: '2026-10-05T09:00:00.000Z',
          batch_id: 'b2',
        }),
      ],
      now,
    )
    expect(view.sent).toBe(2)
    expect(view.opened).toBe(1)
    expect(view.openRate).toBe(0.5)
    const quiet = view.recipients.find((person) => person.email === 'quiet@nhs.net')
    expect(quiet?.quiet).toBe(true)
    expect(view.trusts[0]?.quiet).toBe(1)
  })
})
