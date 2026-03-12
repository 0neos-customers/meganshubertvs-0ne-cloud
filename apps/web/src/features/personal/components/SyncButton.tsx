'use client'

import { useState } from 'react'
import { Button, toast } from '@0ne/ui'
import { RefreshCw, Loader2 } from 'lucide-react'
import { syncPlaidTransactions } from '../hooks/use-plaid-transactions'

interface SyncButtonProps {
  lastSyncedAt?: string | null
  onSyncComplete: () => void
}

export function SyncButton({ lastSyncedAt, onSyncComplete }: SyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const result = await syncPlaidTransactions()
      if (result.success) {
        toast.success(`Synced ${result.synced || 0} transactions, imported ${result.imported || 0}`)
        onSyncComplete()
      } else {
        throw new Error(result.error || 'Sync failed')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          Last synced: {new Date(lastSyncedAt).toLocaleString()}
        </span>
      )}
      <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm">
        {isSyncing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        {isSyncing ? 'Syncing...' : 'Sync'}
      </Button>
    </div>
  )
}
