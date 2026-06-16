import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface PrimaryButtonProps {
  children: ReactNode
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  className?: string
}

export function PrimaryButton({
  children,
  disabled,
  loading,
  type = 'submit',
  onClick,
  className = '',
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={'w-full bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white font-bold py-4 rounded-full mt-2 hover:from-[#6D28D9] hover:to-[#5B21B6] transition-colors flex justify-center items-center gap-2 disabled:opacity-70 ' + className}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  )
}
