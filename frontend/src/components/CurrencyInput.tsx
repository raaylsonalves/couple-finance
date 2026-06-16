interface CurrencyInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  required?: boolean
  min?: string
  step?: string
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  required = false,
  min = '0.01',
  step = '0.01',
}: CurrencyInputProps) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-4 text-gray-500 font-semibold">R$</span>
      <input
        type="number"
        step={step}
        min={min}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={'w-full bg-gray-50 p-4 pl-12 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] ' + className}
      />
    </div>
  )
}
