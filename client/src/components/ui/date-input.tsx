import * as React from 'react';
import { Calendar } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface DateInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange'
  > {
  label?: string;
  error?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, label, error, id, value, onChange, ...props }, ref) => {
    const inputId =
      id || `date-input-${Math.random().toString(36).substr(2, 9)}`;
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value;
      if (dateValue) {
        const date = new Date(dateValue);
        onChange?.(date);
      } else {
        onChange?.(undefined);
      }
    };

    const dateValue = value ? value.toISOString().split('T')[0] : '';

    const handleIconClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (
        inputRef.current &&
        'showPicker' in inputRef.current &&
        typeof (inputRef.current as any).showPicker === 'function'
      ) {
        try {
          (inputRef.current as any).showPicker();
        } catch (err) {
          inputRef.current.focus();
        }
      } else {
        inputRef.current?.focus();
      }
    };

    return (
      <div className='space-y-2'>
        {label && (
          <label
            htmlFor={inputId}
            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
          >
            {label}
          </label>
        )}
        <div className='relative'>
          <Input
            {...props}
            id={inputId}
            ref={inputRef}
            type='date'
            value={dateValue}
            onChange={handleChange}
            className={cn(
              'pr-10',
              error && 'border-destructive focus-visible:ring-destructive',
              className
            )}
          />
          <button
            type='button'
            onClick={handleIconClick}
            className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm p-1.5 hover:bg-accent active:scale-95 transition-all'
            aria-label='Abrir seletor de data'
            tabIndex={-1}
          >
            <Calendar className='h-4 w-4' strokeWidth={2} />
          </button>
        </div>
        {error && <p className='text-sm text-destructive'>{error}</p>}
      </div>
    );
  }
);
DateInput.displayName = 'DateInput';
























