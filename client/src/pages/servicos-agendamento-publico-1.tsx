import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
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
import { apiRequest } from '@/lib/queryClient';
import { ChamadosProLogo } from '@/components/chamados-pro-logo';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
}

export default function ServicosAgendamentoPublico1() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/:publicSlug?');
  const publicSlug =
    params?.publicSlug ||
    window.location.pathname.split('/').filter(Boolean)[0] ||
    '';

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [showTimeSlots, setShowTimeSlots] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Buscar informações do tenant/usuário público
  const { data: publicUser } = useQuery<{
    id: string;
    firstName: string;
    lastName: string;
    publicSlug?: string;
    tenantSlug?: string | null;
    companyName?: string | null;
    companyLogoUrl?: string | null;
  }>({
    queryKey: ['/api/public/user', publicSlug],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/public/user/${publicSlug}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar informações');
      return response.json();
    },
    enabled: !!publicSlug,
  });

  // Buscar serviços do técnico
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/public/services-by-slug', publicSlug],
    enabled: !!publicSlug,
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/public/services-by-slug/${publicSlug}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviços');
      return response.json();
    },
  });

  const activeServices = services?.filter((s) => s.active) || [];

  // Se houver apenas um serviço, selecionar automaticamente
  useMemo(() => {
    if (activeServices.length === 1 && !selectedService) {
      setSelectedService(activeServices[0]);
    }
  }, [activeServices, selectedService]);

  // Calcular range de datas para buscar slots
  const dateRange = useMemo(() => {
    const rangeStart = startOfMonth(currentMonth);
    const rangeEnd = endOfMonth(addMonths(currentMonth, 1));
    return { rangeStart, rangeEnd };
  }, [currentMonth]);

  // Buscar slots disponíveis para todos os serviços
  const { data: allSlots = [], isLoading: slotsLoading } = useQuery<
    AvailableSlot[]
  >({
    queryKey: [
      'public-booking-available-slots-all',
      publicSlug,
      dateRange.rangeStart.toISOString(),
      dateRange.rangeEnd.toISOString(),
    ],
    queryFn: async () => {
      if (!activeServices.length) return [];

      // Buscar slots para todos os serviços ativos
      const allSlotsPromises = activeServices.map((service) =>
        fetchPublicAvailableSlots({
          userSlug: publicSlug as string,
          serviceId: service.id,
          startDate: dateRange.rangeStart,
          endDate: dateRange.rangeEnd,
        })
      );

      const results = await Promise.all(allSlotsPromises);
      // Combinar todos os slots e remover duplicatas
      const combined = results.flat();
      const unique = Array.from(
        new Map(combined.map((slot) => [slot.datetime, slot])).values()
      );
      return unique;
    },
    enabled: !!publicSlug && activeServices.length > 0,
    staleTime: 60000, // Cache por 1 minuto
  });

  // Criar conjunto de datas disponíveis
  const availableDatesSet = useMemo(() => {
    return new Set(allSlots.map((slot) => slot.date));
  }, [allSlots]);

  // Horários disponíveis para a data selecionada
  const availableTimes = useMemo(() => {
    if (!selectedDate) return [];
    const iso = selectedDate.toISOString().split('T')[0];
    return allSlots.filter((slot) => slot.date === iso);
  }, [allSlots, selectedDate]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setShowTimeSlots(true);
    }
  };

  const handleBackToCalendar = () => {
    setShowTimeSlots(false);
    setSelectedDate(undefined);
  };

  const handleTimeSlotClick = (slot: AvailableSlot) => {
    // Encontrar o serviço correspondente ao slot
    // Por enquanto, usar o primeiro serviço ativo ou permitir seleção
    const service = selectedService || activeServices[0];
    if (service) {
      setLocation(`/${publicSlug}/service/${service.id}?datetime=${slot.datetime}`);
    }
  };

  if (!publicSlug) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background-dark p-4'>
        <Card className='max-w-md w-full bg-slate-900 border-slate-800'>
          <CardHeader>
            <CardTitle className='text-white'>Link Inválido</CardTitle>
            <CardContent>
              <p className='text-sm text-gray-400'>
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
      <div className='min-h-screen bg-background-dark flex items-center justify-center p-4'>
        <div className='max-w-4xl w-full space-y-6'>
          <Skeleton className='h-12 w-64 mx-auto bg-slate-800' />
          <Skeleton className='h-96 w-full bg-slate-800' />
        </div>
      </div>
    );
  }

  if (activeServices.length === 0) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background-dark p-4'>
        <Card className='max-w-md w-full bg-slate-900 border-slate-800'>
          <CardHeader>
            <CardTitle className='text-white'>Nenhum Serviço Disponível</CardTitle>
            <CardContent>
              <p className='text-sm text-gray-400'>
                No momento não há serviços disponíveis para agendamento.
              </p>
            </CardContent>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background-dark text-gray-200'>
      {/* Header */}
      <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-b-slate-800 px-4 sm:px-10 py-3 bg-background-dark sticky top-0 z-10 bg-opacity-80 backdrop-blur-sm'>
        <div className='flex items-center gap-4 text-primary'>
          <ChamadosProLogo
            size={32}
            showText={false}
            customLogoUrl={publicUser?.companyLogoUrl}
            customName={publicUser?.companyName}
          />
          <h2 className='text-white text-lg font-bold leading-tight tracking-[-0.015em]'>
            {publicUser?.companyName || 'ChamadosPro'}
          </h2>
        </div>
        <div className='flex flex-1 justify-end'>
          <Button
            className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors'
            onClick={() => {
              window.location.href = '/login';
            }}
          >
            <span className='truncate'>Login do Técnico</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className='max-w-6xl mx-auto px-4 sm:px-6 py-8'>
        <div className='text-center space-y-2 mb-8'>
          <h1 className='text-3xl md:text-4xl font-bold tracking-tight text-white'>
            Agende seu Serviço
          </h1>
          <p className='text-lg text-gray-400'>
            Escolha um dia disponível e depois selecione o horário
          </p>
        </div>

        {!showTimeSlots ? (
          /* Vista: Calendário */
          <Card className='max-w-2xl mx-auto bg-slate-900 border-slate-800'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle className='flex items-center gap-2 text-white'>
                  <CalendarIcon className='h-5 w-5' />
                  Calendário
                </CardTitle>
                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                    className='border-slate-700 text-gray-300 hover:bg-slate-800'
                  >
                    ←
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className='border-slate-700 text-gray-300 hover:bg-slate-800'
                  >
                    →
                  </Button>
                </div>
              </div>
              <p className='text-sm text-gray-400'>
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <Skeleton className='h-96 w-full bg-slate-800' />
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
                  className='rounded-md border border-slate-700'
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
                    day_disabled: 'opacity-30 cursor-not-allowed text-gray-600',
                    day_outside: 'opacity-30 text-gray-600',
                    day: 'text-gray-300 hover:bg-slate-800',
                    day_selected: 'bg-primary text-white',
                  }}
                />
              )}
            </CardContent>
          </Card>
        ) : (
          /* Vista: Horários */
          <Card className='max-w-2xl mx-auto bg-slate-900 border-slate-800'>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={handleBackToCalendar}
                    className='-ml-2 text-gray-300 hover:bg-slate-800'
                  >
                    <ArrowLeft className='h-4 w-4 mr-2' />
                    Voltar
                  </Button>
                  <CardTitle className='flex items-center gap-2 text-white'>
                    <Clock className='h-5 w-5' />
                    Horários Disponíveis
                  </CardTitle>
                </div>
              </div>
              {selectedDate && (
                <p className='text-sm text-gray-400'>
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
                    <Skeleton key={i} className='h-12 w-full bg-slate-800' />
                  ))}
                </div>
              ) : availableTimes.length === 0 ? (
                <div className='text-center py-12'>
                  <Clock className='h-12 w-12 mx-auto text-gray-600 mb-4' />
                  <p className='text-sm text-gray-400'>
                    Não há horários disponíveis para esta data
                  </p>
                  <Button
                    variant='outline'
                    className='mt-4 border-slate-700 text-gray-300 hover:bg-slate-800'
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
                      className='w-full border-slate-700 text-gray-300 hover:bg-primary hover:text-white hover:border-primary'
                      onClick={() => handleTimeSlotClick(slot)}
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
          <Card className='mt-8 max-w-2xl mx-auto bg-slate-900 border-slate-800'>
            <CardHeader>
              <CardTitle className='text-white'>Serviços Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-2'>
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    className='p-3 rounded-lg border border-slate-800 hover:border-primary/50 transition-colors'
                  >
                    <div className='font-semibold text-white'>{service.name}</div>
                    {service.description && (
                      <div className='text-sm text-gray-400 mt-1'>
                        {service.description}
                      </div>
                    )}
                    <div className='text-sm text-gray-400 mt-1'>
                      Duração: {service.duration}h
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className='w-full mt-10 p-4 border-t border-solid border-t-slate-800 bg-background-dark'>
        <div className='max-w-5xl mx-auto text-center'>
          <p className='text-gray-500 text-sm font-normal leading-normal'>
            © 2024 ChamadosPro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
