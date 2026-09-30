import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fontkit from '@pdf-lib/fontkit'
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type { ReportType, TrustReport } from './buildTrustReport.js'
import { dualClock } from './londonTime.js'
import type { ReportPdfSettings } from './pdfSettings.js'
import { hasVisiblePdfFigure } from './pdfSettings.js'
import {
  weekStudyTotal,
  type DayPerformance,
  type VanPerformance,
} from './performance.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 36

const CANVAS = rgb(250 / 255, 251 / 255, 251 / 255)
const WHITE = rgb(1, 1, 1)
const INK = rgb(0.11, 0.11, 0.11)
const MUTED = rgb(0.45, 0.45, 0.45)
const HEADER = rgb(0.953, 0.953, 0.953)
const LINE = rgb(0.9, 0.9, 0.9)
const BRAND = rgb(22 / 255, 22 / 255, 63 / 255)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const ASSET_ORIGIN = 'https://deos-heartbeat.vercel.app'

async function readAsset(pathFromPublic: string): Promise<Uint8Array> {
  try {
    return readFileSync(join(ROOT, 'public', pathFromPublic))
  } catch {
    const response = await fetch(`${ASSET_ORIGIN}/${pathFromPublic}`)
    if (!response.ok) {
      throw new Error(`Missing PDF asset ${pathFromPublic}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
}
const FOOTER_BADGES = [
  'dcb0129.png',
  'cyber-essentials.png',
  'isoqar-ukas.png',
] as const

function formatStudies(value: number | null) {
  if (value == null) return '—'
  return String(Math.round(value))
}

function formatSpeed(value: number | null) {
  if (value == null) return '—'
  return `${value.toFixed(2)} MB/s`
}

function modalityLines(day: DayPerformance) {
  if (!day.modalityStart || !day.modalityEnd) return ['Not available']
  return [`Start  ${dualClock(day.modalityStart)}`, `End    ${dualClock(day.modalityEnd)}`]
}

function drawCard(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  headerHeight: number,
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: WHITE,
    borderColor: LINE,
    borderWidth: 0.8,
  })
  page.drawRectangle({
    x: x + 0.8,
    y: y + h - headerHeight,
    width: w - 1.6,
    height: headerHeight - 0.8,
    color: HEADER,
  })
}

function drawHeader(
  page: PDFPage,
  medium: PDFFont,
  semibold: PDFFont,
  title: string,
  logo: PDFImage,
) {
  const logoWidth = 118
  const logoHeight = (logo.height / logo.width) * logoWidth
  const top = PAGE_HEIGHT - 28
  page.drawImage(logo, {
    x: PAGE_WIDTH - MARGIN - logoWidth,
    y: top - logoHeight,
    width: logoWidth,
    height: logoHeight,
  })

  page.drawText('DEOS HEARTBEAT', {
    x: MARGIN,
    y: top - 14,
    size: 9,
    font: medium,
    color: MUTED,
  })
  page.drawText(title, {
    x: MARGIN,
    y: top - 36,
    size: 18,
    font: semibold,
    color: INK,
  })
  page.drawRectangle({
    x: MARGIN,
    y: top - 48,
    width: 36,
    height: 2.5,
    color: BRAND,
  })

  return top - Math.max(logoHeight, 56) - 18
}

function drawIdentity(
  page: PDFPage,
  regular: PDFFont,
  semibold: PDFFont,
  top: number,
  lines: { trust: string; van: string; period: string },
) {
  let y = top
  page.drawText(lines.trust, { x: MARGIN, y, size: 10, font: regular, color: MUTED })
  y -= 22
  page.drawText(lines.van, { x: MARGIN, y, size: 16, font: semibold, color: INK })
  y -= 18
  page.drawText(lines.period, { x: MARGIN, y, size: 11, font: regular, color: MUTED })
  return y - 22
}

type Card = { caption: string; lines: string[] }

function drawCards(
  page: PDFPage,
  regular: PDFFont,
  medium: PDFFont,
  semibold: PDFFont,
  top: number,
  cards: Card[],
) {
  if (!cards.length) return top
  const gap = 10
  const width = (PAGE_WIDTH - MARGIN * 2 - gap * (cards.length - 1)) / cards.length
  const height = 112
  const headerHeight = 30

  cards.forEach((card, index) => {
    const x = MARGIN + index * (width + gap)
    const y = top - height
    drawCard(page, x, y, width, height, headerHeight)
    page.drawText(card.caption, {
      x: x + 12,
      y: y + height - 19,
      size: 9,
      font: medium,
      color: MUTED,
    })

    if (card.lines.length === 1) {
      page.drawText(card.lines[0] ?? '', {
        x: x + 12,
        y: y + 34,
        size: 20,
        font: semibold,
        color: INK,
      })
    } else {
      card.lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + 12,
          y: y + 52 - lineIndex * 16,
          size: 11,
          font: lineIndex === 0 ? medium : regular,
          color: INK,
        })
      })
    }
  })

  return top - height - 22
}

function dailyCards(day: DayPerformance, fields: ReportPdfSettings): Card[] {
  const cards: Card[] = []
  if (fields.studies) {
    cards.push({ caption: 'Studies transferred', lines: [formatStudies(day.studies)] })
  }
  if (fields.transfer_speed) {
    cards.push({
      caption: 'Average transfer speed',
      lines: [formatSpeed(day.speedMbps)],
    })
  }
  if (fields.modality_window) {
    cards.push({ caption: 'Modality connected', lines: modalityLines(day) })
  }
  return cards
}

type Column = {
  key: 'day' | 'date' | 'studies' | 'speed' | 'modality'
  title: string
  width: number
  align: 'left' | 'right'
}

function weeklyColumns(fields: ReportPdfSettings): Column[] {
  const columns: Column[] = [
    { key: 'day', title: 'Day', width: 0, align: 'left' },
    { key: 'date', title: 'Date', width: 0, align: 'left' },
  ]
  if (fields.studies) {
    columns.push({ key: 'studies', title: 'Studies', width: 0, align: 'right' })
  }
  if (fields.transfer_speed) {
    columns.push({ key: 'speed', title: 'Avg speed', width: 0, align: 'right' })
  }
  if (fields.modality_window) {
    columns.push({
      key: 'modality',
      title: 'Modality connected',
      width: 0,
      align: 'left',
    })
  }
  const weight = columns.reduce((total, column) => total + (column.key === 'modality' ? 1.6 : 1), 0)
  const unit = (PAGE_WIDTH - MARGIN * 2) / weight
  for (const column of columns) {
    column.width = unit * (column.key === 'modality' ? 1.6 : 1)
  }
  return columns
}

function cellLines(day: DayPerformance, key: Column['key']) {
  if (key === 'day') return [day.weekday]
  if (key === 'date') return [day.label]
  if (key === 'studies') return [formatStudies(day.studies)]
  if (key === 'speed') return [formatSpeed(day.speedMbps)]
  return modalityLines(day)
}

function drawWeeklyTable(
  page: PDFPage,
  regular: PDFFont,
  medium: PDFFont,
  semibold: PDFFont,
  top: number,
  days: DayPerformance[],
  fields: ReportPdfSettings,
) {
  const columns = weeklyColumns(fields)
  if (
    columns.length <= 2 &&
    !fields.studies &&
    !fields.transfer_speed &&
    !fields.modality_window
  ) {
    return top
  }

  const headerHeight = 32
  const rowHeight = fields.modality_window ? 42 : 30
  const totalHeight = fields.week_total ? 40 : 0
  const bodyHeight = headerHeight + days.length * rowHeight + totalHeight
  const x0 = MARGIN
  const width = PAGE_WIDTH - MARGIN * 2
  const bottom = top - bodyHeight

  drawCard(page, x0, bottom, width, bodyHeight, headerHeight)

  let x = x0
  for (const column of columns) {
    const titleWidth = medium.widthOfTextAtSize(column.title, 9)
    page.drawText(column.title, {
      x: column.align === 'right' ? x + column.width - titleWidth - 12 : x + 12,
      y: top - 20,
      size: 9,
      font: medium,
      color: MUTED,
    })
    x += column.width
  }

  let y = top - headerHeight
  for (const day of days) {
    page.drawLine({
      start: { x: x0 + 12, y },
      end: { x: x0 + width - 12, y },
      thickness: 0.6,
      color: LINE,
    })
    x = x0
    for (const column of columns) {
      const lines = cellLines(day, column.key)
      const size = lines.length > 1 ? 9 : 10
      const textFont = column.key === 'day' ? medium : regular
      lines.forEach((text, lineIndex) => {
        const textWidth = textFont.widthOfTextAtSize(text, size)
        const lineY = lines.length > 1 ? y - 14 - lineIndex * 12 : y - 19
        page.drawText(text, {
          x: column.align === 'right' ? x + column.width - textWidth - 12 : x + 12,
          y: lineY,
          size,
          font: textFont,
          color: INK,
        })
      })
      x += column.width
    }
    y -= rowHeight
  }

  if (fields.week_total) {
    page.drawLine({
      start: { x: x0 + 12, y },
      end: { x: x0 + width - 12, y },
      thickness: 0.6,
      color: LINE,
    })
    const total = formatStudies(weekStudyTotal(days))
    page.drawText('Studies transferred this week', {
      x: x0 + 12,
      y: y - 24,
      size: 11,
      font: medium,
      color: INK,
    })
    const totalWidth = semibold.widthOfTextAtSize(total, 14)
    page.drawText(total, {
      x: x0 + width - 12 - totalWidth,
      y: y - 25,
      size: 14,
      font: semibold,
      color: BRAND,
    })
  }

  return bottom - 22
}

function drawFooter(page: PDFPage, regular: PDFFont, badges: PDFImage[]) {
  const barHeight = 52
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: barHeight,
    color: BRAND,
  })

  const badgeHeight = 28
  const gap = 8
  const sizes = badges.map((badge) => ({
    image: badge,
    height: badgeHeight,
    width: (badge.width / badge.height) * badgeHeight,
  }))
  const rowWidth =
    sizes.reduce((total, badge) => total + badge.width, 0) +
    gap * Math.max(0, sizes.length - 1)
  let x = PAGE_WIDTH - MARGIN - rowWidth
  const y = (barHeight - badgeHeight) / 2
  for (const badge of sizes) {
    page.drawImage(badge.image, {
      x,
      y,
      width: badge.width,
      height: badge.height,
    })
    x += badge.width + gap
  }
  page.drawText('Counts only  ·  no patient identifiers', {
    x: MARGIN,
    y: barHeight / 2 - 3,
    size: 9,
    font: regular,
    color: WHITE,
  })
}

export async function renderPerformancePdf(input: {
  report: Pick<TrustReport, 'trustName' | 'trustSlug' | 'reportType' | 'generatedAt'>
  vans: VanPerformance[]
  fields: ReportPdfSettings
}): Promise<Uint8Array | null> {
  if (!hasVisiblePdfFigure(input.fields, input.report.reportType)) return null
  if (!input.vans.length) return null

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const regular = await doc.embedFont(await readAsset('fonts/IDGrotesk-Regular-BF652cb1b4787d7.ttf'))
  const medium = await doc.embedFont(await readAsset('fonts/IDGrotesk-Medium-BF652cb1b4765e1.ttf'))
  const semibold = await doc.embedFont(await readAsset('fonts/IDGrotesk-Semibold-BF652cb1b467d9d.ttf'))
  const logo = await doc.embedPng(await readAsset('logo.png'))
  const badges = await Promise.all(
    FOOTER_BADGES.map(async (name) => doc.embedPng(await readAsset(`footer/${name}`))),
  )
  const title =
    input.report.reportType === 'daily'
      ? 'Daily performance summary'
      : 'Weekly performance summary'

  for (const van of input.vans) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      color: CANVAS,
    })
    const belowHeader = drawHeader(page, medium, semibold, title, logo)
    const period =
      input.report.reportType === 'daily'
        ? (van.days[0]?.label ?? '')
        : van.days.length
          ? `${van.days[0].label} – ${van.days[van.days.length - 1].label}`
          : ''
    let y = drawIdentity(page, regular, semibold, belowHeader, {
      trust: input.report.trustName,
      van: van.displayName,
      period,
    })

    if (input.report.reportType === 'daily') {
      const day = van.days[0]
      if (day) drawCards(page, regular, medium, semibold, y, dailyCards(day, input.fields))
    } else {
      drawWeeklyTable(page, regular, medium, semibold, y, van.days, input.fields)
    }

    drawFooter(page, regular, badges)
  }

  doc.setTitle(
    `${input.report.trustName} ${input.report.reportType} performance summary`,
  )
  doc.setCreator('Deos Heartbeat')
  return doc.save()
}

export function performancePdfFilename(
  trustSlug: string,
  reportType: ReportType,
  vans: VanPerformance[],
) {
  const first = vans[0]?.days[0]?.date ?? 'report'
  const last = vans[0]?.days[vans[0].days.length - 1]?.date ?? first
  if (reportType === 'daily') return `${trustSlug}-daily-${first}.pdf`
  return `${trustSlug}-weekly-${first}-to-${last}.pdf`
}
