import { describe, expect, it } from 'vitest'
import { formatReportSlackMessage } from './slackNotify.js'

describe('formatReportSlackMessage', () => {
  it('lists every sent trust, recipient, and PDF in one message', () => {
    const text = formatReportSlackMessage({
      reportType: 'daily',
      sentAt: new Date('2026-10-03T12:00:00Z'),
      items: [
        {
          trustName: 'North Midlands',
          emails: ['jane.smith@trust.nhs.uk', 'ops@trust.nhs.uk'],
          pdfFilename: 'north-midlands-daily-2026-10-02.pdf',
        },
        {
          trustName: 'South West',
          emails: ['reports@southwest.nhs.uk'],
          pdfFilename: 'south-west-daily-2026-10-02.pdf',
        },
      ],
    })

    expect(text).toBe(
      [
        '✅ Daily reports sent — 3 Oct 2026',
        '',
        '2 sent',
        '',
        'North Midlands',
        'Sent to: jane.smith@trust.nhs.uk, ops@trust.nhs.uk',
        'PDF: north-midlands-daily-2026-10-02.pdf',
        '',
        'South West',
        'Sent to: reports@southwest.nhs.uk',
        'PDF: south-west-daily-2026-10-02.pdf',
      ].join('\n'),
    )
  })

  it('uses the weekly label and notes a missing PDF', () => {
    const text = formatReportSlackMessage({
      reportType: 'weekly',
      sentAt: new Date('2026-10-03T12:00:00Z'),
      items: [
        {
          trustName: 'East London',
          emails: ['fleet@eastlondon.nhs.uk'],
          pdfFilename: null,
        },
      ],
    })

    expect(text.startsWith('✅ Weekly reports sent — 3 Oct 2026')).toBe(true)
    expect(text).toContain('PDF: none')
  })
})
