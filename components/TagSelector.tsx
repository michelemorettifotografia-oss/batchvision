'use client'

import { useState } from 'react'

interface TagSelectorProps {
  presets: string[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  disabled?: boolean
  allowCustom?: boolean
}

export default function TagSelector({
  presets,
  value,
  onChange,
  placeholder = 'Add your own…',
  disabled,
  allowCustom = true,
}: TagSelectorProps) {
  const [draft, setDraft] = useState('')

  const toggle = (tag: string) =>
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag])

  const addCustom = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }

  // Custom (non-preset) tags the user added, shown as removable chips.
  const customTags = value.filter((t) => !presets.includes(t))

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs border transition-colors ${
      active ? 'border-blue-500 bg-blue-600/20 text-white' : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
    }`

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((tag) => (
          <button key={tag} type="button" onClick={() => toggle(tag)} disabled={disabled} className={chipClass(value.includes(tag))}>
            {tag}
          </button>
        ))}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full text-xs border border-blue-500 bg-blue-600/20 text-white flex items-center gap-1"
            title="Remove"
          >
            {tag}
            <span className="text-blue-300">✕</span>
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={disabled || !draft.trim()}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm px-4 rounded-lg border border-gray-600 transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}
