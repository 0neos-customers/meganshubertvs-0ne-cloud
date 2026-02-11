'use client'

import { useMemo } from 'react'
import { Card } from '@0ne/ui'
import { Folder, FileImage, FileVideo, File, Check } from 'lucide-react'
import type { GHLMediaFile } from '../types'

interface MediaGridProps {
  files: GHLMediaFile[]
  onFolderClick: (id: string, name: string) => void
  onFileClick: (file: GHLMediaFile) => void
  onSelect: (id: string) => void
  selectedIds: Set<string>
  viewMode: 'grid' | 'list'
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes?: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * Format date in readable format
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Get file type icon based on mime type
 */
function getFileIcon(file: GHLMediaFile) {
  if (file.type === 'folder') {
    return <Folder className="h-8 w-8 text-amber-500" />
  }

  const mimeType = file.mimeType || ''
  if (mimeType.startsWith('image/')) {
    return <FileImage className="h-8 w-8 text-blue-500" />
  }
  if (mimeType.startsWith('video/')) {
    return <FileVideo className="h-8 w-8 text-purple-500" />
  }
  return <File className="h-8 w-8 text-gray-500" />
}

/**
 * Get file type label
 */
function getFileTypeLabel(file: GHLMediaFile): string {
  if (file.type === 'folder') return 'Folder'
  const mimeType = file.mimeType || ''
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType.startsWith('audio/')) return 'Audio'
  if (mimeType.includes('pdf')) return 'PDF'
  return 'File'
}

/**
 * Check if file is an image that can be thumbnailed
 */
function canShowThumbnail(file: GHLMediaFile): boolean {
  if (file.type === 'folder') return false
  const mimeType = file.mimeType || ''
  return mimeType.startsWith('image/')
}

export function MediaGrid({
  files,
  onFolderClick,
  onFileClick,
  onSelect,
  selectedIds,
  viewMode,
}: MediaGridProps) {
  // Sort files: folders first, then by name
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      // Folders first
      if (a.type === 'folder' && b.type !== 'folder') return -1
      if (a.type !== 'folder' && b.type === 'folder') return 1
      // Then alphabetically
      return a.name.localeCompare(b.name)
    })
  }, [files])

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Folder className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">This folder is empty</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Upload files or create a folder to get started
        </p>
      </div>
    )
  }

  if (viewMode === 'list') {
    return (
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="w-10 p-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="text-left p-3 font-medium text-sm">Name</th>
              <th className="text-left p-3 font-medium text-sm w-24">Type</th>
              <th className="text-left p-3 font-medium text-sm w-24">Size</th>
              <th className="text-left p-3 font-medium text-sm w-32">Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.map((file, index) => {
              const isSelected = selectedIds.has(file.id)
              const isFolder = file.type === 'folder'

              return (
                <tr
                  key={file.id || `file-${index}`}
                  className={`border-b last:border-b-0 cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isFolder) {
                      onFolderClick(file.id, file.name)
                    } else {
                      onFileClick(file)
                    }
                  }}
                  onDoubleClick={() => {
                    if (isFolder) {
                      onFolderClick(file.id, file.name)
                    } else {
                      onFileClick(file)
                    }
                  }}
                >
                  <td className="p-3">
                    <label
                      className="flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelect(file.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </label>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file)}
                      <span className="truncate max-w-xs">{file.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {getFileTypeLabel(file)}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {formatDate(file.createdAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  // Grid view
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {sortedFiles.map((file, index) => {
        const isSelected = selectedIds.has(file.id)
        const isFolder = file.type === 'folder'
        const showThumbnail = canShowThumbnail(file)

        return (
          <Card
            key={file.id || `file-${index}`}
            className={`relative cursor-pointer p-3 transition-all ${
              isSelected
                ? 'ring-2 ring-primary bg-primary/5'
                : 'hover:border-primary/50'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              if (isFolder) {
                onFolderClick(file.id, file.name)
              } else {
                onFileClick(file)
              }
            }}
            onDoubleClick={() => {
              if (isFolder) {
                onFolderClick(file.id, file.name)
              } else {
                onFileClick(file)
              }
            }}
          >
            {/* Checkbox */}
            <label
              className="absolute top-2 left-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-primary border-primary'
                    : 'bg-white border-gray-300 hover:border-primary/50'
                }`}
                onClick={() => onSelect(file.id)}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
            </label>

            {/* Thumbnail/Icon */}
            <div className="aspect-square flex items-center justify-center bg-muted/30 rounded-md mb-2 overflow-hidden">
              {showThumbnail && file.url ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center">
                  {getFileIcon(file)}
                </div>
              )}
            </div>

            {/* File name */}
            <p className="text-sm font-medium truncate" title={file.name}>
              {file.name}
            </p>

            {/* File size (for files only) */}
            {!isFolder && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatFileSize(file.size)}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
