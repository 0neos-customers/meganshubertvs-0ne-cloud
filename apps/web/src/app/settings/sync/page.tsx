'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@0ne/ui'
import { RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Play, Calendar, PlayCircle } from 'lucide-react'
import { AppShell } from '@/components/shell'
import {
  useSyncLog,
  useSchedules,
  formatSyncType,
  formatDuration,
  formatDateTime,
  type SyncLogEntry,
} from '@/features/settings/hooks'
import type { CronJobWithStatus } from '@/features/settings/lib/cron-registry'
import type { SyncType, SyncStatus } from '@/lib/sync-log'

// Valid sync types for the filter dropdown
const SYNC_TYPES: { value: SyncType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'ghl_contacts', label: 'GHL Contacts' },
  { value: 'ghl_payments', label: 'GHL Payments' },
  { value: 'skool', label: 'Skool' },
  { value: 'skool_analytics', label: 'Skool Analytics' },
  { value: 'skool_member_history', label: 'Skool Member History' },
  { value: 'meta', label: 'Meta Ads' },
]

// Status badge component
function StatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </Badge>
      )
    case 'running':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      )
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

// Activity Table component
function ActivityTable({
  logs,
  isLoading,
  emptyMessage = 'No sync activity recorded yet',
}: {
  logs: SyncLogEntry[]
  isLoading: boolean
  emptyMessage?: string
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Sync jobs will appear here once they run
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Type</TableHead>
            <TableHead className="w-[180px]">Started</TableHead>
            <TableHead className="w-[100px] text-right">Duration</TableHead>
            <TableHead className="w-[100px] text-right">Records</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-medium">
                {formatSyncType(log.syncType)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(log.startedAt)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatDuration(log.durationSeconds)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {log.recordsSynced.toLocaleString()}
              </TableCell>
              <TableCell>
                <StatusBadge status={log.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Activity Tab content
function ActivityTab() {
  const [typeFilter, setTypeFilter] = useState<SyncType | 'all'>('all')

  const { data, isLoading, error, mutate } = useSyncLog({
    type: typeFilter === 'all' ? undefined : typeFilter,
    limit: 100,
    refreshInterval: 30000, // Auto-refresh every 30 seconds
  })

  return (
    <div className="space-y-4">
      {/* Filters and refresh */}
      <div className="flex items-center justify-between">
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as SyncType | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            {SYNC_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Failed to load sync activity</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Summary stats */}
      {data && data.summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{data.summary.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-semibold text-green-600">
              {data.summary.completed}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Running</p>
            <p className="text-2xl font-semibold text-blue-600">
              {data.summary.running}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-semibold text-red-600">
              {data.summary.failed}
            </p>
          </div>
        </div>
      )}

      {/* Activity table */}
      <ActivityTable
        logs={data?.logs || []}
        isLoading={isLoading}
        emptyMessage={
          typeFilter !== 'all'
            ? `No ${formatSyncType(typeFilter as SyncType)} sync activity found`
            : undefined
        }
      />

      {/* Auto-refresh indicator */}
      <p className="text-xs text-muted-foreground text-center">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  )
}

// Schedule Card component
function ScheduleCard({
  schedule,
  isRunning,
  onRunNow,
}: {
  schedule: CronJobWithStatus
  isRunning: boolean
  onRunNow: () => void
}) {
  const lastRun = schedule.lastRun

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{schedule.name}</h3>
          <p className="text-sm text-muted-foreground">{schedule.description}</p>
        </div>
        {lastRun && <StatusBadge status={lastRun.status} />}
      </div>

      {/* Schedule info */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>{schedule.schedule}</span>
      </div>

      {/* Last run info */}
      <div className="rounded-md bg-muted/50 p-3 space-y-1">
        {lastRun ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last run:</span>
              <span className="font-medium">{formatDateTime(lastRun.startedAt)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{formatDuration(lastRun.durationSeconds)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Records synced:</span>
              <span className="font-medium tabular-nums">{lastRun.recordsSynced.toLocaleString()}</span>
            </div>
            {lastRun.errorMessage && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                {lastRun.errorMessage}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No runs recorded yet
          </p>
        )}
      </div>

      {/* Run Now button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onRunNow}
        disabled={isRunning || lastRun?.status === 'running'}
      >
        {isRunning || lastRun?.status === 'running' ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            Run Now
          </>
        )}
      </Button>
    </div>
  )
}

// Schedules Tab content
function SchedulesTab() {
  const [isRunningAll, setIsRunningAll] = useState(false)
  const { schedules, isLoading, error, runningCrons, runSync, refresh } = useSchedules()

  const handleRunNow = async (cronId: string) => {
    const result = await runSync(cronId)
    if (!result.success) {
      // In a real app, you'd show a toast notification here
      console.error('Failed to trigger sync:', result.error)
    }
  }

  const handleRunAll = async () => {
    setIsRunningAll(true)
    try {
      // Run all syncs in parallel
      const results = await Promise.all(
        schedules.map((schedule) => runSync(schedule.id))
      )
      const failed = results.filter((r) => !r.success)
      if (failed.length > 0) {
        console.error(`${failed.length} syncs failed to trigger`)
      }
    } finally {
      setIsRunningAll(false)
    }
  }

  const isAnySyncRunning = isRunningAll || Object.values(runningCrons).some(Boolean)

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to load schedules</p>
        <p className="text-sm mt-1">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Run All and refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {schedules.length} scheduled sync jobs
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleRunAll}
            disabled={isAnySyncRunning}
          >
            {isRunningAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running All...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Run All Syncs
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Schedule cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            isRunning={runningCrons[schedule.id] || false}
            onRunNow={() => handleRunNow(schedule.id)}
          />
        ))}
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        Click "Run All Syncs" to trigger all jobs, or "Run Now" on individual cards. Syncs run in the background.
      </p>
    </div>
  )
}

// Main Sync Page component
export default function SyncPage() {
  return (
    <AppShell title="0ne">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and manage all data sync jobs
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Data Synchronization
            </CardTitle>
            <CardDescription>
              View sync activity and manage scheduled jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activity">
              <TabsList>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="schedules">Schedules</TabsTrigger>
              </TabsList>
              <TabsContent value="activity" className="mt-6">
                <ActivityTab />
              </TabsContent>
              <TabsContent value="schedules" className="mt-6">
                <SchedulesTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
