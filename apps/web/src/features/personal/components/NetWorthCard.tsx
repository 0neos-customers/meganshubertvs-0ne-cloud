'use client'

import { Card, CardContent } from '@0ne/ui'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { usePlaidBalances } from '../hooks/use-plaid-balances'

function formatCurrency(amount: number): string {
  const prefix = amount < 0 ? '-' : ''
  return `${prefix}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function NetWorthCard() {
  const { summary, isLoading } = usePlaidBalances()

  if (isLoading || !summary) return null

  const TrendIcon =
    summary.netWorth > 0 ? TrendingUp : summary.netWorth < 0 ? TrendingDown : Minus
  const trendColor =
    summary.netWorth > 0
      ? 'text-green-600'
      : summary.netWorth < 0
        ? 'text-red-600'
        : 'text-muted-foreground'

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Net Worth</p>
            <p className={`text-2xl font-bold ${trendColor}`}>
              {formatCurrency(summary.netWorth)}
            </p>
          </div>
          <TrendIcon className={`h-8 w-8 ${trendColor}`} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Assets</p>
            <p className="font-semibold text-green-600">{formatCurrency(summary.totalAssets)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Liabilities</p>
            <p className="font-semibold text-red-600">
              {formatCurrency(summary.totalLiabilities)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
