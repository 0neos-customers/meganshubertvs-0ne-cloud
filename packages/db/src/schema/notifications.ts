import { pgTable, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

// ─── Notification Preferences ────────────────────────────────────────────────

export const notificationPreferences = pgTable('notification_preferences', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  dailySnapshotEnabled: boolean('daily_snapshot_enabled').default(false),
  deliveryTime: text('delivery_time'),
  deliveryEmail: text('delivery_email'),
  deliveryMethod: text('delivery_method').default('email'),
  metricsConfig: jsonb('metrics_config'),
  alertThresholds: jsonb('alert_thresholds'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_notification_preferences_enabled_time').on(table.dailySnapshotEnabled, table.deliveryTime),
])
