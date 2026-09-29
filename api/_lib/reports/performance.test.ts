import { describe, expect, it } from 'vitest'
import { londonDaysEndingYesterday, londonToday } from './londonTime.js'
import { bucketVanDays } from './performance.js'
import { hasVisiblePdfFigure, parseReportPdfSettings } from './pdfSettings.js'
import { renderPerformancePdf } from './renderPerformancePdf.js'
import { reportPeriod, safeReportFilename } from './storeGeneratedReport.js'

describe('london report windows', () => {
  it('covers the previous Monday to Sunday when the cron runs on Monday', () => {
    const days = londonDaysEndingYesterday(7, new Date('2026-09-28T05:30:00Z'))
    expect(days.map((day) => day.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ])
    expect(days[0].weekday).toBe('Mon')
    expect(days[6].weekday).toBe('Sun')
  })

  it('uses the London calendar date for the daily report', () => {
    const day = londonToday(new Date('2026-09-27T22:30:00Z'))
    expect(day.date).toBe('2026-09-27')
  })
})

describe('bucketVanDays', () => {
  const day = londonToday(new Date('2026-09-27T12:00:00Z'))

  it('takes the peak studies count, average speed, and modality window', () => {
    const days = bucketVanDays({
      van: {
        instance: 'trust.van1',
        displayName: 'Van 1',
        modalityTarget: 'trust.van1.mod',
        studiesToday: null,
        syncSpeedMbps: null,
      },
      days: [day],
      studies: [
        {
          metric: { instance: 'trust.van1' },
          values: [
            [day.startSec + 3600, '10'],
            [day.startSec + 7200, '43'],
            [day.startSec + 8000, '40'],
          ],
        },
      ],
      speeds: [
        {
          metric: { instance: 'trust.van1' },
          values: [
            [day.startSec + 3600, '2000000'],
            [day.startSec + 7200, '2480000'],
          ],
        },
      ],
      modality: [
        {
          metric: { instance: 'trust.van1.mod' },
          values: [
            [day.startSec + 44 * 60, '1'],
            [day.startSec + 12 * 3600, '1'],
            [day.startSec + 18 * 3600 + 3 * 60, '1'],
            [day.startSec + 19 * 3600, '0'],
          ],
        },
      ],
    })

    expect(days[0].studies).toBe(43)
    expect(days[0].speedMbps).toBeCloseTo(2.24, 2)
    expect(days[0].modalityStart).toMatch(/^\d{2}:\d{2}$/)
    expect(days[0].modalityEnd).toMatch(/^\d{2}:\d{2}$/)
    expect(days[0].modalityStart).not.toBe(days[0].modalityEnd)
  })
})

describe('report pdf settings', () => {
  it('defaults every figure on and keeps explicit false values', () => {
    expect(parseReportPdfSettings(null).studies).toBe(true)
    expect(parseReportPdfSettings({ studies: false }).studies).toBe(false)
    expect(parseReportPdfSettings({ studies: false }).transfer_speed).toBe(true)
  })

  it('hides the PDF when every figure is off', () => {
    const off = {
      studies: false,
      transfer_speed: false,
      modality_window: false,
      week_total: false,
    }
    expect(hasVisiblePdfFigure(off, 'daily')).toBe(false)
    expect(hasVisiblePdfFigure({ ...off, week_total: true }, 'daily')).toBe(false)
    expect(hasVisiblePdfFigure({ ...off, week_total: true }, 'weekly')).toBe(true)
  })
})

describe('renderPerformancePdf', () => {
  it('builds a PDF with the selected daily figures', async () => {
    const bytes = await renderPerformancePdf({
      report: {
        trustName: 'North Midlands',
        trustSlug: 'north-midlands',
        reportType: 'daily',
        generatedAt: '2026-09-27T12:00:00Z',
      },
      fields: {
        studies: true,
        transfer_speed: true,
        modality_window: true,
        week_total: false,
      },
      vans: [
        {
          instance: 'tic.lhc',
          displayName: 'TIC LHC-NORTH-MIDLANDS',
          days: [
            {
              date: '2026-09-27',
              weekday: 'Sun',
              label: '27 Sep 2026',
              studies: 43,
              speedMbps: 2.24,
              modalityStart: '06:44',
              modalityEnd: '18:03',
            },
          ],
        },
      ],
    })
    expect(bytes).not.toBeNull()
    const header = Buffer.from(bytes!).subarray(0, 5).toString('utf8')
    expect(header).toBe('%PDF-')
  })
})

describe('reportPeriod', () => {
  const van = {
    instance: 'tic.lhc',
    displayName: 'TIC LHC',
    days: [
      {
        date: '2026-09-21',
        weekday: 'Mon',
        label: '21 Sep 2026',
        studies: 1,
        speedMbps: 1,
        modalityStart: '08:00',
        modalityEnd: '17:00',
      },
      {
        date: '2026-09-27',
        weekday: 'Sun',
        label: '27 Sep 2026',
        studies: 2,
        speedMbps: 1,
        modalityStart: null,
        modalityEnd: null,
      },
    ],
  }

  it('labels a weekly range from the first van day to the last', () => {
    expect(reportPeriod('weekly', [van])).toEqual({
      periodStart: '2026-09-21',
      periodEnd: '2026-09-27',
      periodLabel: '21 Sep 2026 – 27 Sep 2026',
    })
  })

  it('uses the first day for a daily report and keeps filenames pdf-safe', () => {
    expect(reportPeriod('daily', [van]).periodLabel).toBe('21 Sep 2026')
    expect(safeReportFilename('North Midlands daily (27-09-2026).pdf')).toBe(
      'North-Midlands-daily-27-09-2026.pdf',
    )
  })
})
