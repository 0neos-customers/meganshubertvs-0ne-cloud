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
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@0ne/ui'
import {
  RefreshCw,
  Loader2,
  MessageSquare,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { useRawMessages, type RawMessage } from '@/features/dm-sync/hooks/use-raw-messages'

// Direction options for filter
const DIRECTION_OPTIONS = [
  { value: 'all', label: 'All Directions' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

// Status options for filter
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'synced', label: 'Synced' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

// Format timestamp for display
function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Truncate message text
function truncateMessage(text: string | null, maxLength = 80): string {
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Helper to convert username to display name
function usernameToDisplayName(username: string | null): string {
  if (!username) return ''
  let name = username.replace(/^@/, '')
  name = name.replace(/-\d+$/, '')
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Build Skool member search URL
function buildSkoolSearchUrl(communitySlug: string | null, username: string | null): string {
  if (!communitySlug || !username) return ''
  const searchName = usernameToDisplayName(username)
  return `https://www.skool.com/${communitySlug}/-/search?q=${encodeURIComponent(searchName)}&t=members`
}

// Build GHL contact URL
function buildGhlContactUrl(locationId: string | null, contactId: string | null): string {
  if (!locationId || !contactId) return ''
  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`
}

// Direction badge component
function DirectionBadge({ direction }: { direction: RawMessage['direction'] }) {
  if (direction === 'inbound') {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
        <ArrowDownLeft className="h-3 w-3" />
        In
      </Badge>
    )
  }
  return (
    <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
      <ArrowUpRight className="h-3 w-3" />
      Out
    </Badge>
  )
}

// Status badge component
function StatusBadge({ status }: { status: RawMessage['status'] }) {
  const configs = {
    synced: {
      className: 'bg-green-100 text-green-800 border-green-200',
      icon: CheckCircle2,
      label: 'Synced',
    },
    pending: {
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: Clock,
      label: 'Pending',
    },
    failed: {
      className: 'bg-red-100 text-red-800 border-red-200',
      icon: XCircle,
      label: 'Failed',
    },
  }

  const config = configs[status] || configs.pending
  const Icon = config.icon

  return (
    <Badge className={`${config.className} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

// Deep links component
function DeepLinks({ message }: { message: RawMessage }) {
  const skoolUrl = buildSkoolSearchUrl(message.skoolCommunitySlug, message.skoolUsername)
  const ghlUrl = buildGhlContactUrl(message.ghlLocationId, message.ghlContactId)

  return (
    <div className="flex items-center gap-2">
      {/* Skool Link */}
      {skoolUrl ? (
        <a
          href={skoolUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
          title="Search in Skool"
        >
          <span className="text-xs font-medium">S</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-muted-foreground/50 text-xs">S</span>
      )}
      {/* GHL Link */}
      {ghlUrl ? (
        <a
          href={ghlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-primary hover:text-primary/80"
          title="Open in GHL"
        >
          <span className="text-xs font-medium">G</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-muted-foreground/50 text-xs">G</span>
      )}
    </div>
  )
}

// Stats card component
function StatsCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value: number
  className?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${className || 'bg-muted'}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Messages table component
function MessagesTable({
  messages,
  isLoading,
}: {
  messages: RawMessage[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center border rounded-lg bg-muted/50">
        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No messages found</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Messages will appear here once captured by the extension
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Dir</TableHead>
            <TableHead className="w-[140px]">Sender</TableHead>
            <TableHead className="min-w-[280px]">Message</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[100px]">Time</TableHead>
            <TableHead className="w-[80px] text-right">Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((msg) => (
            <TableRow key={msg.id}>
              <TableCell>
                <DirectionBadge direction={msg.direction} />
              </TableCell>
              <TableCell className="font-medium">
                {msg.senderName || usernameToDisplayName(msg.skoolUsername) || msg.skoolUserId.slice(0, 8)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <span title={msg.messageText || undefined}>
                  {truncateMessage(msg.messageText)}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={msg.status} />
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatTimestamp(msg.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                <DeepLinks message={msg} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// Main page component
export default function RawMessagesPage() {
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState('all')
  const [status, setStatus] = useState('all')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setOffset(0) // Reset pagination on search
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
    return () => clearTimeout(timeoutId)
  }

  const handleFilterChange = (
    setter: (value: string) => void,
    value: string
  ) => {
    setter(value)
    setOffset(0) // Reset pagination on filter change
  }

  const { messages, summary, pagination, isLoading, error, refresh } = useRawMessages({
    search: debouncedSearch,
    direction: direction as 'inbound' | 'outbound' | 'all',
    status: status as 'synced' | 'pending' | 'failed' | 'all',
    limit,
    offset,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Raw Messages</h1>
          <p className="text-sm text-muted-foreground">
            View all DM messages captured by the Skool extension
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard
          icon={MessageSquare}
          label="Total"
          value={summary.total}
          className="bg-gray-100 text-gray-600"
        />
        <StatsCard
          icon={ArrowDownLeft}
          label="Inbound"
          value={summary.inbound}
          className="bg-blue-100 text-blue-600"
        />
        <StatsCard
          icon={ArrowUpRight}
          label="Outbound"
          value={summary.outbound}
          className="bg-green-100 text-green-600"
        />
        <StatsCard
          icon={CheckCircle2}
          label="Synced"
          value={summary.synced}
          className="bg-emerald-100 text-emerald-600"
        />
        <StatsCard
          icon={Clock}
          label="Pending"
          value={summary.pending}
          className="bg-yellow-100 text-yellow-600"
        />
        <StatsCard
          icon={XCircle}
          label="Failed"
          value={summary.failed}
          className="bg-red-100 text-red-600"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Failed to load messages</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Main Content Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
          </CardTitle>
          <CardDescription>
            Raw DM data from the Skool extension. <strong>S</strong> = Skool member search, <strong>G</strong> = GHL contact (available when synced)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Direction Filter */}
            <Select
              value={direction}
              onValueChange={(v) => handleFilterChange(setDirection, v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                {DIRECTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={status}
              onValueChange={(v) => handleFilterChange(setStatus, v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <MessagesTable messages={messages} isLoading={isLoading} />

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + limit, offset + messages.length)} of{' '}
              {summary.total} messages
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={!pagination.hasMore || isLoading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Auto-refresh indicator */}
          <p className="text-xs text-muted-foreground text-center">
            Auto-refreshes every 15 seconds
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
