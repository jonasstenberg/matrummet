'use client'

import { useFormStatus } from 'react-dom'
import { Button, type ButtonProps } from './button'

interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  loadingText?: string
}

export function SubmitButton({
  children,
  loadingText = 'Laddar...',
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? loadingText : children}
    </Button>
  )
}
