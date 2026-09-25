import {
  boolean,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const vanStatusEnum = pgEnum('van_status', [
  'active',
  'paused',
  'unassigned',
  'removed',
])

export const userRoleEnum = pgEnum('user_role', ['admin', 'viewer'])

export const reportTypeEnum = pgEnum('report_type', ['daily', 'weekly'])

export const reportRunStatusEnum = pgEnum('report_run_status', [
  'success',
  'failure',
])

export const trusts = pgTable('trusts', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  dailyEnabled: boolean('daily_enabled').notNull().default(true),
  weeklyEnabled: boolean('weekly_enabled').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const vans = pgTable('vans', {
  id: uuid('id').defaultRandom().primaryKey(),
  trustId: uuid('trust_id').references(() => trusts.id, { onDelete: 'set null' }),
  instance: text('instance').notNull().unique(),
  displayName: text('display_name').notNull(),
  modalityTarget: text('modality_target'),
  dailyEnabled: boolean('daily_enabled').notNull().default(true),
  weeklyEnabled: boolean('weekly_enabled').notNull().default(true),
  speedFloor: numeric('speed_floor'),
  status: vanStatusEnum('status').notNull().default('unassigned'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const recipients = pgTable('recipients', {
  id: uuid('id').defaultRandom().primaryKey(),
  trustId: uuid('trust_id')
    .notNull()
    .references(() => trusts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  fullName: text('full_name'),
  role: userRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const reportRuns = pgTable('report_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  trustId: uuid('trust_id')
    .notNull()
    .references(() => trusts.id, { onDelete: 'cascade' }),
  reportType: reportTypeEnum('report_type').notNull(),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  status: reportRunStatusEnum('status').notNull(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
})
