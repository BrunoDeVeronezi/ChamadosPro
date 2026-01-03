import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Clock, ChevronLeft, Check, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface DateTimePickerProps {
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  timeSlots?: string[]; // Lista base de horarios a exibir
  availableDates?: Set<string>; // Datas que possuem pelo menos um horário disponível
  availableTimes?: string[]; // Horários disponíveis para a data selecionada
  unavailableDays?: Set<string>; // Dias indisponíveis (eventos de dia inteiro do Google Calendar)
  workingDays?: number[]; // Dias da semana permitidos (0=domingo...6=sabado)
  isLoadingAvailability?: boolean; // Se está carregando dados do Google Calendar
  required?: boolean;
  error?: boolean; 
  errorTime?: boolean; 
  className?: string;
}

export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  timeSlots,
  availableDates,
  availableTimes,
  unavailableDays,
  workingDays,
  isLoadingAvailability,
  required,
  error,
  errorTime,
  className,
}: DateTimePickerProps) {
  React.useEffect(() => {
    if (unavailableDays) {
      console.log('[DateTimePicker] 📅 unavailableDays recebido:', unavailableDays.size, Array.from(unavailableDays));
    }
  }, [unavailableDays]);

  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    date ? new Date(date + 'T00:00:00') : undefined
  );
  const [viewMode, setViewMode] = React.useState<'calendar' | 'time'>(
    date ? 'time' : 'calendar'
  );
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date());

  // Gerar horários disponíveis (de 8h às 18h, intervalos de 30 minutos)
  const fallbackTimeSlots = React.useMemo(() => {
    const slots: string[] = [];
    for (let hour = 8; hour < 18; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
      slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
  }, []);
  const displayTimeSlots =
    timeSlots !== undefined ? timeSlots : fallbackTimeSlots;
  const selectedDateLabel = React.useMemo(() => {
    if (!selectedDate) return '';
    const datePart = format(selectedDate, 'dd/MM/yyyy', { locale: ptBR });
    const dayPart = format(selectedDate, 'EEEE', { locale: ptBR })
      .replace(/-/g, ' ')
      .split(' ')
      .map((word) =>
        word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : ''
      )
      .join(' ');
    return `${datePart} ${dayPart}`;
  }, [selectedDate]);

  const handleDateSelect = (selected: Date | undefined) => {
    console.log('[DateTimePicker] 📅 handleDateSelect chamado com:', selected);
    if (selected) {
      setSelectedDate(selected);
      const dateStr = format(selected, 'yyyy-MM-dd');
      console.log('[DateTimePicker] 📅 Chamando onDateChange com:', dateStr);
      onDateChange(dateStr);
      setViewMode('time');
    }
  };

  const handleTimeSelect = (selectedTime: string) => {
    onTimeChange(selectedTime);
  };

  // Atualizar selectedDate quando date mudar externamente
  React.useEffect(() => {
    if (date) {
      const d = new Date(date + 'T00:00:00');
      setSelectedDate(d);
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      // Se tiver data, vai pros horários, senão volta pro calendário
      setViewMode('time');
    } else {
      setSelectedDate(undefined);
      setViewMode('calendar');
    }
  }, [date]);

  return (
    <div
      className={cn(
        'bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden relative max-h-[500px]',
        className
      )}
    >
      <div 
        className="flex transition-transform duration-500 ease-in-out w-[200%] h-full"
        style={{ transform: viewMode === 'time' ? 'translateX(-50%)' : 'translateX(0)' }}
      >
        {/* Lado 1: Calendário */}
        <div className="w-1/2 p-3 sm:p-4 space-y-3 shrink-0 overflow-hidden flex flex-col">
          <div className='flex items-center justify-between shrink-0 mb-1'>
            <div className='flex items-center gap-2'>
              <CalendarIcon className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground dark:text-slate-400">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
            </div>
            <div className='flex gap-1'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                className='h-7 w-7 rounded-md hover:bg-primary/10'
              >
                <ChevronLeft className='h-3.5 w-3.5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                className='h-7 w-7 rounded-md hover:bg-primary/10'
              >
                <ChevronLeft className='h-3.5 w-3.5 rotate-180' />
              </Button>
            </div>
          </div>

          <div className={cn(
            'bg-white dark:bg-slate-900/80 rounded-2xl p-2 sm:p-3 border border-gray-100 dark:border-slate-800 shadow-sm transition-all overflow-hidden flex-1 min-h-0',
            error && 'input-error'
          )}>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              initialFocus
              locale={ptBR}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Desabilitar datas passadas
                if (date < today) return true;

                if (workingDays && workingDays.length > 0) {
                  const dayOfWeek = date.getDay();
                  if (!workingDays.includes(dayOfWeek)) {
                    return true;
                  }
                }

                const dateStr = format(date, 'yyyy-MM-dd');

                // PRIORIDADE 1: Desabilitar dias com eventos de dia inteiro do Google Calendar
                // Isso deve ter prioridade sobre availableDates
                if (unavailableDays && unavailableDays.size > 0) {
                  if (unavailableDays.has(dateStr)) {
                    console.log('[DateTimePicker] 🚫 Dia desabilitado por unavailableDays:', dateStr);
                    return true;
                  }
                }

                // PRIORIDADE 2: Se tivermos lista de datas disponíveis, desabilitar as que não estão nela
                // Mas apenas se o dia não estiver em unavailableDays
                if (availableDates && availableDates.size > 0) {
                  const isNotAvailable = !availableDates.has(dateStr);
                  if (isNotAvailable) {
                    console.log('[DateTimePicker] 🚫 Dia desabilitado por availableDates:', dateStr);
                  }
                  return isNotAvailable;
                }

                return false;
              }}
              className="w-full"
              classNames={{
                months: "w-full space-y-1",
                month: "w-full space-y-1",
                caption: "hidden", 
                table: "w-full border-collapse",
                head_row: "flex w-full",
                head_cell: "text-muted-foreground dark:text-slate-500 rounded-md flex-1 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest py-1.5 px-0",
                row: "flex w-full mt-0.5",
                cell: "flex-1 text-center p-0 relative focus-within:relative focus-within:z-20 min-w-0",
                day: "h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 p-0 font-medium aria-selected:opacity-100 hover:bg-primary/10 hover:text-primary rounded-lg transition-all mx-auto flex items-center justify-center text-[10px] sm:text-xs dark:text-slate-300 border border-transparent",
                day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white shadow-lg shadow-primary/30 scale-105 z-10 border-primary",
                day_today: "bg-primary/10 text-primary font-black border-primary/20",
                day_outside: "text-muted-foreground/40 dark:text-slate-600 opacity-50",
                day_disabled: "text-muted-foreground/30 dark:text-slate-700 opacity-40 cursor-not-allowed",
              }}
            />
          </div>
        </div>

        {/* Lado 2: Horários */}
        <div className="w-1/2 p-3 sm:p-4 space-y-3 shrink-0 flex flex-col overflow-hidden">
          <div className={cn(
            'bg-white dark:bg-slate-900/80 rounded-xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm flex-1 min-h-0 transition-all',
            errorTime && 'input-error'
          )}>
            <div className='p-2 sm:p-3 space-y-2 flex-1 overflow-y-auto scrollbar-thin'>
              <div className='grid grid-cols-[1fr_auto_1fr] items-center mb-2 shrink-0 px-1'>
                <div className='flex items-center gap-2'>
                  <Clock className='h-3.5 w-3.5 text-primary' />
                  <h3 className='text-[10px] font-black uppercase tracking-widest text-muted-foreground'>
                    Escolha o Horário
                  </h3>
                </div>
                {selectedDateLabel ? (
                  <div className='text-[11px] font-semibold text-muted-foreground tracking-wide text-center'>
                    {selectedDateLabel}
                  </div>
                ) : (
                  <div />
                )}
                <div className='justify-self-end'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => setViewMode('calendar')}
                    className='h-7 gap-1 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors hover:bg-primary/5 rounded-lg'
                  >
                    <ChevronLeft className='h-3 w-3' />
                    Voltar
                  </Button>
                </div>
              </div>
              
              {(() => {
                // IMPORTANTE: Diferença entre undefined e array vazio []
                // - undefined: não filtrar, mostrar todos os horários como disponíveis
                // - array vazio []: todos os horários indisponíveis, mostrar mensagem de erro
                console.log('[DateTimePicker] 🔍 availableTimes recebido:', {
                  isUndefined: availableTimes === undefined,
                  isNull: availableTimes === null,
                  isArray: Array.isArray(availableTimes),
                  length: availableTimes?.length,
                  type: typeof availableTimes,
                  value: availableTimes,
                });
                
                // Apenas mostrar mensagem se for array vazio [] (não undefined, não null)
                const isArrayEmpty = Array.isArray(availableTimes) && availableTimes.length === 0;
                
                if (isArrayEmpty && !isLoadingAvailability) {
                  console.log('[DateTimePicker] ⚠️ availableTimes é array vazio [] - mostrando mensagem "Sem horários para este dia"');
                  return (
                    <div className='flex flex-col items-center justify-center py-8 px-4 text-center'>
                      <XCircle className='h-12 w-12 text-destructive mb-3' />
                      <p className='text-destructive font-semibold text-sm'>
                        Sem horários para este dia
                      </p>
                    </div>
                  );
                }
                
                if (availableTimes === undefined) {
                  console.log('[DateTimePicker] ✅ availableTimes é undefined - mostrando todos os horários como disponíveis (não filtrar)');
                } else if (availableTimes && availableTimes.length > 0) {
                  console.log('[DateTimePicker] ✅ availableTimes tem', availableTimes.length, 'horários disponíveis');
                }

                return (
                  <div className='grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3'>
                    {displayTimeSlots.map((slot) => {
                      const isSelected = time === slot;
                      // Se availableTimes estiver definido, verificar se o slot está disponível
                      // Se não estiver definido (undefined), considerar todos como disponíveis
                      const isUnavailable = availableTimes ? !availableTimes.includes(slot) : false;
                      
                      return (
                        <button
                          key={slot}
                          type='button'
                          onClick={() => {
                            if (!isUnavailable) {
                              handleTimeSelect(slot);
                            }
                          }}
                          disabled={isUnavailable}
                          className={cn(
                            'flex items-center justify-center py-4 sm:py-6 rounded-xl border text-sm sm:text-base font-black transition-all relative',
                            isUnavailable
                              ? 'bg-gray-100 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-600 opacity-50 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-primary border-primary text-white shadow-xl shadow-primary/30 scale-105 z-10'
                              : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-primary/50 hover:text-primary hover:bg-white dark:hover:bg-slate-700 hover:shadow-md'
                          )}
                        >
                          {slot}
                          {isSelected && !isUnavailable && (
                            <div className='absolute -top-1 -right-1 bg-white text-primary rounded-full p-0.5 shadow-sm'>
                              <Check className='h-2 w-2' />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
