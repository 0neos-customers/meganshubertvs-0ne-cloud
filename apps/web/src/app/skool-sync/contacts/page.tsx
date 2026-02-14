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
  Users,
  MessageSquare,
  Clock,
  AlertCircle,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Search,
} from 'lucide-react'
import { useContactActivity, type ContactActivity } from '@/features/dm-sync'

// Match method options for filter
const MATCH_METHODS = [
  { value: 'all', label: 'All Methods' },
  { value: 'skool_id', label: 'Skool ID' },
  { value: 'email', label: 'Email' },
  { value: 'name', label: 'Name' },
  { value: 'synthetic', label: 'Synthetic' },
]

// Status options for filter
const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'synced', label: 'Synced' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]

// Helper to build GHL contact URL
function buildGhlContactUrl(locationId: string, contactId: string): string {
  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`
}

// Helper to convert username to display name
// e.g. "jamirah-west-9157" -> "Jamirah West"
function usernameToDisplayName(username: string | null): string {
  if (!username) return ''
  // Remove @ prefix if present
  let name = username.replace(/^@/, '')
  // Remove trailing numbers (e.g., -9157)
  name = name.replace(/-\d+$/, '')
  // Replace hyphens with spaces and title case
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Helper to build Skool member search URL
function buildSkoolSearchUrl(communitySlug: string, username: string | null): string {
  if (!communitySlug || !username) return ''
  // Convert username to search-friendly display name
  const searchName = usernameToDisplayName(username)
  return `https://www.skool.com/${communitySlug}/-/search?q=${encodeURIComponent(searchName)}&t=members`
}

// Match method badge component
function MatchMethodBadge({ method }: { method: ContactActivity['match_method'] }) {
  const variants: Record<string, { className: string; label: string }> = {
    skool_id: { className: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Skool ID' },
    email: { className: 'bg-green-100 text-green-800 border-green-200', label: 'Email' },
    name: { className: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Name' },
    synthetic: { className: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Synthetic' },
  }

  const config = method ? variants[method] : { className: 'bg-gray-100 text-gray-600', label: '-' }

  return <Badge className={config.className}>{config.label}</Badge>
}

// Status indicator component
function StatusIndicator({ contact }: { contact: ContactActivity }) {
  const { synced_count, pending_count, failed_count } = contact.stats

  if (failed_count > 0) {
    return (
      <div className="flex items-center gap-1 text-red-600">
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">{failed_count} failed</span>
      </div>
    )
  }

  if (pending_count > 0) {
    return (
      <div className="flex items-center gap-1 text-yellow-600">
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">{pending_count} pending</span>
      </div>
    )
  }

  if (synced_count > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm font-medium">{synced_count} synced</span>
      </div>
    )
  }

  return <span className="text-sm text-muted-foreground">-</span>
}

// Message count display
function MessageCounts({ contact }: { contact: ContactActivity }) {
  const { inbound_count, outbound_count } = contact.stats

  if (inbound_count === 0 && outbound_count === 0) {
    return <span className="text-sm text-muted-foreground">-</span>
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex items-center gap-0.5" title="Inbound messages">
        <ArrowDownLeft className="h-3 w-3 text-muted-foreground" />
        {inbound_count}
      </span>
      <span className="flex items-center gap-0.5" title="Outbound messages">
        <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
        {outbound_count}
      </span>
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

// Contacts table component
function ContactsTable({
  contacts,
  isLoading,
}: {
  contacts: ContactActivity[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center border rounded-lg bg-muted/50">
        <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">No contacts found</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Contacts will appear here once synced from Skool
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[140px]">Username</TableHead>
            <TableHead className="w-[100px]">Method</TableHead>
            <TableHead className="w-[120px]">Messages</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[100px] text-right">Links</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            // Derive display name from username if not stored
            const displayName =
              contact.skool_display_name || usernameToDisplayName(contact.skool_username)

            return (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">{displayName || '-'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {contact.skool_username ? `@${contact.skool_username}` : '-'}
                </TableCell>
                <TableCell>
                  <MatchMethodBadge method={contact.match_method} />
                </TableCell>
                <TableCell>
                  <MessageCounts contact={contact} />
                </TableCell>
                <TableCell>
                  <StatusIndicator contact={contact} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Skool Link */}
                    {contact.skool_community_slug && contact.skool_username ? (
                      <a
                        href={buildSkoolSearchUrl(
                          contact.skool_community_slug,
                          contact.skool_username
                        )}
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
                    {contact.ghl_location_id && contact.ghl_contact_id ? (
                      <a
                        href={buildGhlContactUrl(contact.ghl_location_id, contact.ghl_contact_id)}
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
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// Main page component
export default function ContactActivityPage() {
  const [search, setSearch] = useState('')
  const [matchMethod, setMatchMethod] = useState('all')
  const [status, setStatus] = useState('all')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearch(value)
    // Simple debounce using setTimeout
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value)
    }, 300)
    return () => clearTimeout(timeoutId)
  }

  const { contacts, summary, isLoading, error, refresh } = useContactActivity({
    search: debouncedSearch,
    matchMethod,
    status,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contact Sync Activity</h1>
          <p className="text-sm text-muted-foreground">
            Monitor sync status for each Skool community member
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          icon={Users}
          label="Contacts"
          value={summary.total_contacts}
          className="bg-blue-100 text-blue-600"
        />
        <StatsCard
          icon={MessageSquare}
          label="Messages"
          value={summary.total_messages}
          className="bg-green-100 text-green-600"
        />
        <StatsCard
          icon={Clock}
          label="Pending"
          value={summary.contacts_with_pending}
          className="bg-yellow-100 text-yellow-600"
        />
        <StatsCard
          icon={AlertCircle}
          label="Failed"
          value={summary.contacts_with_failed}
          className="bg-red-100 text-red-600"
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Failed to load contact activity</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Main Content Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contacts
          </CardTitle>
          <CardDescription>
            Skool members mapped to GHL contacts with sync status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Match Method Filter */}
            <Select value={matchMethod} onValueChange={setMatchMethod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Match Method" />
              </SelectTrigger>
              <SelectContent>
                {MATCH_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={status} onValueChange={setStatus}>
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
          <ContactsTable contacts={contacts} isLoading={isLoading} />

          {/* Auto-refresh indicator */}
          <p className="text-xs text-muted-foreground text-center">
            Auto-refreshes every 30 seconds
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
