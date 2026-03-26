'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@0ne/ui'
import { Loader2, Layers, RefreshCw } from 'lucide-react'
import { DAY_NAMES, type DayOfWeek } from '@0ne/db'
import { useCategories } from '../hooks/use-categories'
import { useVariationGroups } from '../hooks/use-variation-groups'

export interface SchedulerFormData {
  id?: string
  groupSlug: string
  category: string
  categoryId: string | null
  dayOfWeek: DayOfWeek
  time: string
  variationGroupId: string | null
  isActive: boolean
  note: string
}

interface SchedulerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduler?: SchedulerFormData | null
  onSave: (data: SchedulerFormData) => Promise<void>
  isSaving?: boolean
}

const defaultFormData: SchedulerFormData = {
  groupSlug: 'my-community',
  category: '',
  categoryId: null,
  dayOfWeek: 1, // Monday
  time: '09:00',
  variationGroupId: null,
  isActive: true,
  note: '',
}


export function SchedulerDialog({
  open,
  onOpenChange,
  scheduler,
  onSave,
  isSaving = false,
}: SchedulerDialogProps) {
  const [formData, setFormData] = useState<SchedulerFormData>(defaultFormData)
  const { categories, isLoading: categoriesLoading, isRefreshing, refresh: refreshCategories, source } = useCategories()
  const { groups: variationGroups, isLoading: groupsLoading } = useVariationGroups()
  const isEditMode = !!scheduler?.id

  // Reset form when dialog opens/closes or scheduler changes
  useEffect(() => {
    if (open && scheduler) {
      setFormData({
        id: scheduler.id,
        groupSlug: scheduler.groupSlug || 'my-community',
        category: scheduler.category || '',
        categoryId: scheduler.categoryId || null,
        dayOfWeek: scheduler.dayOfWeek ?? 1,
        time: scheduler.time || '09:00',
        variationGroupId: scheduler.variationGroupId || null,
        isActive: scheduler.isActive ?? true,
        note: scheduler.note || '',
      })
    } else if (open && !scheduler) {
      setFormData(defaultFormData)
    }
  }, [open, scheduler])

  const handleSubmit = async () => {
    await onSave(formData)
  }

  const handleCategoryChange = (categoryName: string) => {
    const selectedCategory = categories.find((c) => c.name === categoryName)
    setFormData({
      ...formData,
      category: categoryName,
      categoryId: selectedCategory?.id || null,
    })
  }

  const isValid = formData.category && formData.time && formData.variationGroupId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Recurring Post' : 'Add Recurring Post'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the schedule slot details below.'
              : 'Create a new recurring schedule slot for automated posts.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Category */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="scheduler-category" className="text-sm font-medium">
                Skool Category (where to post)
              </label>
              <button
                type="button"
                onClick={refreshCategories}
                disabled={isRefreshing || categoriesLoading}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
                title="Refresh categories from Skool"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            <Select
              value={formData.category}
              onValueChange={handleCategoryChange}
              disabled={categoriesLoading || isRefreshing}
            >
              <SelectTrigger id="scheduler-category">
                <SelectValue placeholder={categoriesLoading ? 'Loading...' : 'Select category'} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {source === 'fallback' && (
              <p className="text-xs text-amber-600">
                Using fallback categories. Click Refresh to fetch from Skool.
              </p>
            )}
          </div>

          {/* Day of Week and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label htmlFor="scheduler-day" className="text-sm font-medium">
                Day of Week
              </label>
              <Select
                value={String(formData.dayOfWeek)}
                onValueChange={(value) =>
                  setFormData({ ...formData, dayOfWeek: parseInt(value, 10) as DayOfWeek })
                }
              >
                <SelectTrigger id="scheduler-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="scheduler-time" className="text-sm font-medium">
                Time (ET)
              </label>
              <Input
                id="scheduler-time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>

          {/* Variation Group */}
          <div className="grid gap-2">
            <label htmlFor="scheduler-group" className="text-sm font-medium flex items-center gap-1">
              <Layers className="h-4 w-4" />
              Variation Group (content source)
            </label>
            <Select
              value={formData.variationGroupId || ''}
              onValueChange={(value) =>
                setFormData({ ...formData, variationGroupId: value || null })
              }
              disabled={groupsLoading}
            >
              <SelectTrigger id="scheduler-group">
                <SelectValue
                  placeholder={groupsLoading ? 'Loading...' : 'Select variation group'}
                />
              </SelectTrigger>
              <SelectContent>
                {variationGroups
                  .filter((g) => g.isActive)
                  .map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Posts will be pulled from this variation group
            </p>
          </div>

          {/* Note */}
          <div className="grid gap-2">
            <label htmlFor="scheduler-note" className="text-sm font-medium">
              Note (optional)
            </label>
            <Input
              id="scheduler-note"
              placeholder="e.g., Monday motivation post"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label htmlFor="scheduler-active" className="text-sm font-medium">
                Active
              </label>
              <p className="text-xs text-muted-foreground">Enable automated posting for this slot</p>
            </div>
            <Switch
              id="scheduler-active"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? 'Save Changes' : 'Add Recurring Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
