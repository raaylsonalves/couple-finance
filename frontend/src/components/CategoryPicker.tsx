import type { CategoryMeta } from '../types'

interface CategoryPickerProps {
  categories: CategoryMeta[]
  selected: string
  onChange: (label: string) => void
}

export function CategoryPicker({ categories, selected, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map(cat => (
        <button
          key={cat.label}
          type="button"
          onClick={() => onChange(cat.label)}
          className={(selected === cat.label ? 'border-[#7C3AED] bg-purple-50' : 'border-transparent bg-gray-50 hover:bg-gray-100') + ' flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all'}
        >
          <span className="text-xl">{cat.icon}</span>
          <span className="text-xs text-center leading-tight">{cat.label}</span>
        </button>
      ))}
    </div>
  )
}
