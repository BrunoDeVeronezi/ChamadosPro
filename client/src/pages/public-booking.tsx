import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import {
  startOfMonth,
  endOfMonth,
  addMonths,
  format,
  startOfDay,
} from 'date-fns';
import {
  fetchPublicAvailableSlots,
  type AvailableSlot,
} from '@/lib/public-booking';

interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: number;
  active: boolean;
}

export default function PublicBooking() {
  const [, params] = useRoute('/:publicSlug');
  const publicSlug = params?.publicSlug;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [showTimeSlots, setShowTimeSlots] = useState(false);

  // Buscar serviços do técnico
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/public/services-by-slug', publicSlug],
    enabled: !!publicSlug,
    queryFn: async () => {
      const response = await fetch(
        `/api/public/services-by-slug/${publicSlug}`
      );
      if (!response.ok) throw new Error('Erro ao buscar serviços');
      return response.json();
    },
  });

  // Pegar o primeiro serviço ativo (ou podemos deixar o usuário escolher depois)
  const primaryService = useMemo(() => {
    return services?.find((s) => s.active) || services?.[0];
  }, [services]);

  // Calcular range de datas para buscar slots
  const dateRange = useMemo(() => {
    const rangeStart = startOfMonth(currentMonth);
    const rangeEnd = endOfMonth(addMonths(currentMonth, 1));
    return { rangeStart, rangeEnd };
  }, [currentMonth]);

  // Buscar slots disponíveis
  const { data: slots = [], isLoading: slotsLoading } = useQuery<
    AvailableSlot[]
  >({
    queryKey: [
      'public-booking-available-slots',
      publicSlug,
      primaryService?.id,
      dateRange.rangeStart.toISOString(),
      dateRange.rangeEnd.toISOString(),
    ],
    queryFn: () =>
      primaryService
        ? fetchPublicAvailableSlots({
            userSlug: publicSlug as string,
            serviceId: primaryService.id,
            startDate: dateRange.rangeStart,
            endDate: dateRange.rangeEnd,
          })
        : Promise.resolve([]),
    enabled: !!publicSlug && !!primaryService,
    staleTime: 60000, // Cache por 1 minuto
  });

  // Criar conjunto de datas disponíveis
  const availableDatesSet = useMemo(() => {
    return new Set(slots.map((slot) => slot.date));
  }, [slots]);

  // Horários disponíveis para a data selecionada
  const availableTimes = useMemo(() => {
    if (!selectedDate) return [];
    const iso = selectedDate.toISOString().split('T')[0];
    return slots.filter((slot) => slot.date === iso);
  }, [slots, selectedDate]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setShowTimeSlots(true); // Mostrar horários e esconder calendário
    }
  };

  const handleBackToCalendar = () => {
    setShowTimeSlots(false);
    setSelectedDate(undefined);
  };

  if (!publicSlug) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background p-4'>
        <Card className='max-w-md w-full'>
          <CardHeader>
            <CardTitle>Link Inválido</CardTitle>
            <CardContent>
              <p className='text-sm text-muted-foreground'>
                Este link de agendamento não é válido. Entre em contato com o
                prestador de serviço.
              </p>
            </CardContent>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (servicesLoading) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center p-4'>
        <div className='max-w-4xl w-full space-y-6'>
          <Skeleton className='h-12 w-64 mx-auto' />
          <Skeleton className='h-96 w-full' />
        </div>
      </div>
    );
  }

  if (!primaryService) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background p-4'>
        <Card className='max-w-md w-full'>
          <CardHeader>
            <CardTitle>Nenhum Serviço Disponível</CardTitle>
            <CardContent>
              <p className='text-sm text-muted-foreground'>
                No momento não há serviços disponíveis para agendamento.
              </p>
            </CardContent>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      {/* Header */}
      <div className='border-b bg-card'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8'>
          <div className='text-center space-y-2'>
            <h1 className='text-3xl md:text-4xl font-bold tracking-tight'>
              Agende seu Serviço
            </h1>
            <p className='text-lg text-muted-foreground'>
              Escolha um dia disponível e depois selecione o horário
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8'>
        {!showTimeSlots ? (
          /* Vista: Apenas Calendário */
          <Card className='max-w-2xl mx-auto'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='flex items-center gap-2'>
                  <CalendarIcon className='h-5 w-5' />
                  Calendário
                </CardTitle>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                  >
                    ←
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    →
                  </Button>
                </div>
              </div>
              <p className='text-sm text-muted-foreground'>
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <Skeleton className='h-96 w-full' />
              ) : (
                <Calendar
                  mode='single'
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  month={currentMonth}
                  onMonthChange={(month) =>
                    month && setCurrentMonth(startOfMonth(month))
                  }
                  locale={ptBR}
                  disabled={(date) => {
                    const normalized = startOfDay(date);

                    // Desabilitar datas passadas
                    if (normalized < today) return true;

                    // Desabilitar domingos
                    if (normalized.getDay() === 0) return true;

                    // Desabilitar datas não disponíveis
                    const iso = normalized.toISOString().split('T')[0];
                    return !availableDatesSet.has(iso);
                  }}
                  className='rounded-md border'
                  modifiers={{
                    available: (date) => {
                      const iso = startOfDay(date).toISOString().split('T')[0];
                      return availableDatesSet.has(iso);
                    },
                  }}
                  modifiersClassNames={{
                    available:
                      'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold ring-2 ring-primary/20',
                  }}
                  classNames={{
                    day_disabled: 'opacity-30 cursor-not-allowed',
                    day_outside: 'opacity-30',
                  }}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          /* Vista: Apenas Horários */
          <Card className='max-w-2xl mx-auto'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={handleBackToCalendar}
                    className='-ml-2'
                  >
                    <ArrowLeft className='h-4 w-4 mr-2' />
                    Voltar
                  </Button>
                  <CardTitle className='flex items-center gap-2'>
                    <Clock className='h-5 w-5' />
                    Horários Disponíveis
                  </CardTitle>
                </div>
              </div>
              {selectedDate && (
                <p className='text-sm text-muted-foreground'>
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className='space-y-2'>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className='h-12 w-full' />
                  ))}
                </div>
              ) : availableTimes.length === 0 ? (
                <div className='text-center py-12'>
                  <Clock className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
                  <p className='text-sm text-muted-foreground'>
                    Não há horários disponíveis para esta data
                  </p>
                  <Button
                    variant='outline'
                    className='mt-4'
                    onClick={handleBackToCalendar}
                  >
                    <ArrowLeft className='h-4 w-4 mr-2' />
                    Voltar ao calendário
                  </Button>
                </div>
              ) : (
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto'>
                  {availableTimes.map((slot) => (
                    <Button
                      key={slot.datetime}
                      variant='outline'
                      className='w-full'
                    >
                      <Clock className='h-4 w-4 mr-2' />
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Service Info - apenas quando mostra o calendário */}
        {!showTimeSlots && (
          <Card className='mt-8 max-w-2xl mx-auto'>
            <CardHeader>
              <CardTitle>Informações do Serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                <div>
                  <span className='font-semibold'>Serviço: </span>
                  <span>{primaryService.name}</span>
                </div>
                <div>
                  <span className='font-semibold'>Duração: </span>
                  <span>{primaryService.duration}h</span>
                </div>
                {primaryService.description && (
                  <div>
                    <span className='font-semibold'>Descrição: </span>
                    <span>{primaryService.description}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
