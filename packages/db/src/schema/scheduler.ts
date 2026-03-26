import { pgTable, uuid, text, integer, boolean, timestamp, date, numeric, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'

// ── skool_variation_groups ─────────────────────────────────────────────────────

export const skoolVariationGroups = pgTable('skool_variation_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── skool_scheduled_posts ──────────────────────────────────────────────────────

export const skoolScheduledPosts = pgTable('skool_scheduled_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupSlug: text('group_slug').default('my-community'),
  category: text('category'),
  categoryId: text('category_id'),
  dayOfWeek: integer('day_of_week'),
  time: text('time'),
  variationGroupId: uuid('variation_group_id').references(() => skoolVariationGroups.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('skool_scheduled_posts_cat_day_time_idx').on(table.category, table.dayOfWeek, table.time),
  index('skool_scheduled_posts_category_idx').on(table.category),
  index('skool_scheduled_posts_day_time_idx').on(table.dayOfWeek, table.time),
  index('skool_scheduled_posts_active_idx').on(table.isActive),
  index('skool_scheduled_posts_variation_group_idx').on(table.variationGroupId),
])

// ── skool_post_library ─────────────────────────────────────────────────────────

export const skoolPostLibrary = pgTable('skool_post_library', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category'),
  dayOfWeek: integer('day_of_week'),
  time: text('time'),
  variationGroupId: uuid('variation_group_id').references(() => skoolVariationGroups.id, { onDelete: 'set null' }),
  title: text('title'),
  body: text('body'),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  isActive: boolean('is_active').default(true),
  status: text('status').default('active'),
  source: text('source').default('manual'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  useCount: integer('use_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('skool_post_library_category_idx').on(table.category),
  index('skool_post_library_day_time_idx').on(table.dayOfWeek, table.time),
  index('skool_post_library_last_used_idx').on(table.lastUsedAt),
  index('skool_post_library_active_idx').on(table.isActive),
  index('skool_post_library_status_idx').on(table.status),
  index('skool_post_library_variation_group_idx').on(table.variationGroupId),
])

// ── skool_post_execution_log ───────────────────────────────────────────────────

export const skoolPostExecutionLog = pgTable('skool_post_execution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  schedulerId: uuid('scheduler_id').references(() => skoolScheduledPosts.id),
  postLibraryId: uuid('post_library_id').references(() => skoolPostLibrary.id),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow(),
  status: text('status'),
  skoolPostId: text('skool_post_id'),
  skoolPostUrl: text('skool_post_url'),
  errorMessage: text('error_message'),
  emailBlastSent: boolean('email_blast_sent').default(false),
}, (table) => [
  index('skool_post_execution_log_executed_at_idx').on(table.executedAt),
  index('skool_post_execution_log_scheduler_idx').on(table.schedulerId),
  index('skool_post_execution_log_status_idx').on(table.status),
])

// ── skool_campaigns ────────────────────────────────────────────────────────────

export const skoolCampaigns = pgTable('skool_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('skool_campaigns_active_idx').on(table.isActive),
  index('skool_campaigns_dates_idx').on(table.startDate, table.endDate),
])

// ── skool_oneoff_posts ─────────────────────────────────────────────────────────

export const skoolOneoffPosts = pgTable('skool_oneoff_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupSlug: text('group_slug').default('my-community'),
  category: text('category'),
  categoryId: text('category_id'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  timezone: text('timezone').default('America/Chicago'),
  title: text('title'),
  body: text('body'),
  imageUrl: text('image_url'),
  videoUrl: text('video_url'),
  campaignId: uuid('campaign_id').references(() => skoolCampaigns.id, { onDelete: 'set null' }),
  sendEmailBlast: boolean('send_email_blast').default(false),
  status: text('status').default('scheduled'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  skoolPostId: text('skool_post_id'),
  skoolPostUrl: text('skool_post_url'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('skool_oneoff_posts_due_idx').on(table.status, table.scheduledAt),
  index('skool_oneoff_posts_campaign_idx').on(table.campaignId),
  index('skool_oneoff_posts_status_idx').on(table.status),
  index('skool_oneoff_posts_scheduled_at_idx').on(table.scheduledAt),
])

// ── skool_group_settings ───────────────────────────────────────────────────────

export const skoolGroupSettings = pgTable('skool_group_settings', {
  groupSlug: text('group_slug').primaryKey(),
  lastEmailBlastAt: timestamp('last_email_blast_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
