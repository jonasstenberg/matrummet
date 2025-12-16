'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface CategorySelectorProps {
  selectedCategories: string[]
  onChange: (categories: string[]) => void
}

export function CategorySelector({
  selectedCategories,
  onChange,
}: CategorySelectorProps) {
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newCategory, setNewCategory] = useState('')
  const [showAddNew, setShowAddNew] = useState(false)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('http://localhost:4444/categories?select=name')
        const data = await response.json()
        const categories = data.map((cat: { name: string }) => cat.name)
        setAvailableCategories(categories)
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  function toggleCategory(category: string) {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter((c) => c !== category))
    } else {
      onChange([...selectedCategories, category])
    }
  }

  function handleAddNew() {
    const trimmed = newCategory.trim()
    if (!trimmed) return

    // Add to selected categories
    if (!selectedCategories.includes(trimmed)) {
      onChange([...selectedCategories, trimmed])
    }

    // Add to available categories if not already there
    if (!availableCategories.includes(trimmed)) {
      setAvailableCategories([...availableCategories, trimmed])
    }

    // Reset form
    setNewCategory('')
    setShowAddNew(false)
  }

  return (
    <div className="space-y-4">
      <Label className="text-base">Kategorier</Label>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laddar kategorier...</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map((category) => (
              <Badge
                key={category}
                variant={
                  selectedCategories.includes(category) ? 'default' : 'outline'
                }
                className="cursor-pointer"
                onClick={() => toggleCategory(category)}
              >
                {category}
                {selectedCategories.includes(category) && (
                  <span className="ml-1">✓</span>
                )}
              </Badge>
            ))}
          </div>

          {showAddNew ? (
            <div className="flex gap-2">
              <Input
                placeholder="Ny kategori"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNew()
                  }
                }}
              />
              <Button type="button" onClick={handleAddNew} size="sm">
                Lägg till
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddNew(false)
                  setNewCategory('')
                }}
              >
                Avbryt
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddNew(true)}
            >
              Lägg till ny kategori
            </Button>
          )}

          {selectedCategories.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium mb-2">Valda kategorier:</p>
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map((category) => (
                  <Badge key={category} variant="default">
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
