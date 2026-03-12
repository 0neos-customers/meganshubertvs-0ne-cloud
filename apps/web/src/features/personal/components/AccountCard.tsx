'use client'

import { Card, CardContent, Button } from '@0ne/ui'
import { Building2, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import type { PlaidItem } from '../hooks/use-plaid-accounts'

interface AccountCardProps {
  item: PlaidItem
  onUnlink: (itemId: string) => Promise<void>
}

function formatBalance(balance: number | null): string {
  if (balance === null || balance === undefined) return '—'
  return `$${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getTypeBadgeColor(type: string): string {
  switch (type) {
    case 'depository': return 'bg-green-100 text-green-700'
    case 'credit': return 'bg-red-100 text-red-700'
    case 'loan': return 'bg-yellow-100 text-yellow-700'
    case 'investment': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export function AccountCard({ item, onUnlink }: AccountCardProps) {
  const [isUnlinking, setIsUnlinking] = useState(false)

  const handleUnlink = async () => {
    setIsUnlinking(true)
    try {
      await onUnlink(item.id)
    } finally {
      setIsUnlinking(false)
    }
  }

  const hasError = item.status !== 'active'

  return (
    <Card>
      <CardContent className="p-6">
        {/* Institution header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">{item.institution_name || 'Unknown Institution'}</h3>
              <p className="text-xs text-muted-foreground">
                {item.last_synced_at
                  ? `Last synced: ${new Date(item.last_synced_at).toLocaleDateString()}`
                  : 'Never synced'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            title="Unlink account"
          >
            {isUnlinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Error state */}
        {hasError && (
          <div className="flex items-center gap-2 mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {item.status === 'login_required'
                ? 'Login required — please reconnect this account'
                : `Error: ${item.error_code || item.status}`}
            </span>
          </div>
        )}

        {/* Account list */}
        <div className="space-y-3">
          {item.accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{account.name}</span>
                    {account.mask && (
                      <span className="text-xs text-muted-foreground">••{account.mask}</span>
                    )}
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${getTypeBadgeColor(account.type)}`}>
                    {account.subtype || account.type}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">
                  {formatBalance(account.current_balance)}
                </div>
                {account.available_balance !== null && account.available_balance !== account.current_balance && (
                  <div className="text-xs text-muted-foreground">
                    Available: {formatBalance(account.available_balance)}
                  </div>
                )}
                {account.type === 'credit' && account.credit_limit && (
                  <div className="text-xs text-muted-foreground">
                    Limit: {formatBalance(account.credit_limit)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {item.accounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No accounts found
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
