'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PlaidTransaction {
  id: string
  transaction_id: string
  account_id: string
  amount: number
  date: string
  name: string | null
  merchant_name: string | null
  mapped_category: string | null
  personal_expense_id: string | null
  is_excluded: boolean
  is_pending: boolean
  plaid_accounts: {
    name: string
    mask: string | null
    type: string
    plaid_items: { institution_name: string } | null
  }
}

interface UsePlaidTransactionsReturn {
  transactions: PlaidTransaction[]
  total: number
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function usePlaidTransactions(options: {
  accountId?: string | null
  startDate?: string | null
  endDate?: string | null
  category?: string | null
  search?: string | null
  page?: number
  limit?: number
} = {}): UsePlaidTransactionsReturn {
  const { accountId, startDate, endDate, category, search, page = 1, limit = 50 } = options
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const url = new URL('/api/personal/banking/transactions', window.location.origin)
      if (accountId) url.searchParams.set('accountId', accountId)
      if (startDate) url.searchParams.set('startDate', startDate)
      if (endDate) url.searchParams.set('endDate', endDate)
      if (category) url.searchParams.set('category', category)
      if (search) url.searchParams.set('search', search)
      url.searchParams.set('page', String(page))
      url.searchParams.set('limit', String(limit))

      const response = await fetch(url.toString())
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const result = await response.json()
      setTransactions(result.transactions || [])
      setTotal(result.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [accountId, startDate, endDate, category, search, page, limit])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { transactions, total, isLoading, error, refetch: fetchData }
}

export async function syncPlaidTransactions(itemId?: string): Promise<{ success: boolean; synced?: number; imported?: number; error?: string }> {
  const response = await fetch('/api/personal/banking/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemId ? { item_id: itemId } : {}),
  })
  return response.json()
}

export async function updatePlaidTransaction(
  id: string,
  updates: { is_excluded?: boolean; mapped_category?: string | null }
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/personal/banking/transactions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  })
  return response.json()
}
