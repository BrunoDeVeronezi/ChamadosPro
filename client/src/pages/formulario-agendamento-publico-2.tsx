import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Clock } from 'lucide-react';
import { maskPhone } from '@/lib/masks';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  fetchPublicAvailableSlots,
  type AvailableSlot,
} from '@/lib/public-booking';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
}

interface Technician {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export default function FormularioAgendamentoPublico2() {
  const [, params] = useRoute('/:publicSlug/service/:serviceId');
  const publicSlug = params?.publicSlug;
  const serviceId = params?.serviceId;
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

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
      'public-booking-available-slots-form',
      publicSlug,
      serviceId,
      dateRange.rangeStart.toISOString(),
      dateRange.rangeEnd.toISOString(),
    ],
    queryFn: () =>
      publicSlug && serviceId
        ? fetchPublicAvailableSlots({
            userSlug: publicSlug,
            serviceId: serviceId,
            startDate: dateRange.rangeStart,
            endDate: dateRange.rangeEnd,
          })
        : Promise.resolve([]),
    enabled: !!publicSlug && !!serviceId,
    staleTime: 60000, // Cache por 1 minuto
  });

  // Horários disponíveis para a data selecionada
  const availableTimes = useMemo(() => {
    if (!selectedDate) return [];
    const iso = selectedDate;
    return slots
      .filter((slot) => slot.date === iso)
      .map((slot) => slot.time)
      .sort();
  }, [slots, selectedDate]);

  const { data: service, isLoading: serviceLoading } = useQuery<Service>({
    queryKey: ['/api/public/services', publicSlug, serviceId],
    queryFn: async () => {
      // Tentar primeiro com o endpoint que aceita slug
      try {
        const response = await apiRequest(
          'GET',
          `/api/public/services-by-slug/${publicSlug}`,
          undefined
        );
        if (response.ok) {
          const services = await response.json();
          const foundService = services.find(
            (s: Service) => s.id === serviceId
          );
          if (foundService) return foundService;
        }
      } catch (e) {
        console.warn('Erro ao buscar serviço por slug:', e);
      }

      // Fallback: tentar endpoint direto
      const response = await apiRequest(
        'GET',
        `/api/public/services/${serviceId}?slug=${publicSlug}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviço');
      return response.json();
    },
    enabled: !!publicSlug && !!serviceId,
  });

  const { data: technician } = useQuery<Technician>({
    queryKey: ['/api/public/technician', publicSlug],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/public/technician/${publicSlug}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar técnico');
      return response.json();
    },
    enabled: !!publicSlug,
  });

  const bookingMutation = useMutation({
    mutationFn: async (
      data: typeof formData & { date: string; time: string }
    ) => {
      // Combinar data e hora em um datetime ISO
      const scheduledDateTime = new Date(`${data.date}T${data.time}:00`);

      const response = await apiRequest('POST', '/api/public/booking/request', {
        userSlug: publicSlug,
        serviceId,
        scheduledDate: scheduledDateTime.toISOString(),
        clientName: data.fullName,
        clientEmail: data.email,
        clientPhone: data.phone,
        clientType: 'PF',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao confirmar agendamento');
      }
      return response.json();
    },
    onSuccess: () => {
      // Incrementar tentativas de agendamento (para CAPTCHA condicional)
      const attempts = parseInt(
        localStorage.getItem('booking_attempts') || '0'
      );
      localStorage.setItem('booking_attempts', String(attempts + 1));

      toast({
        title: 'Agendamento confirmado',
        description:
          'Seu agendamento foi confirmado com sucesso! Você receberá um e-mail com os detalhes.',
      });

      // Redirecionar para página de sucesso ou voltar para lista de serviços
      setTimeout(() => {
        window.location.href = `/${publicSlug}`;
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao confirmar agendamento',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedTime) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Por favor, selecione uma data e um horário.',
      });
      return;
    }

    bookingMutation.mutate({
      ...formData,
      date: selectedDate,
      time: selectedTime,
    });
  };

  return (
    <div className='font-display bg-background-dark'>
      <div className='relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden'>
        <div className='layout-container flex h-full grow flex-col'>
          <header className='flex items-center justify-center whitespace-nowrap border-b border-solid border-slate-800 bg-background-dark px-10 py-3 w-full'>
            <div className='flex items-center gap-4 text-slate-200'>
              <div className='size-5 text-primary'>
                <svg
                  fill='none'
                  viewBox='0 0 48 48'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path
                    d='M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z'
                    fill='currentColor'
                  ></path>
                </svg>
              </div>
              <h2 className='text-slate-200 text-lg font-bold leading-tight tracking-[-0.015em]'>
                ChamadosPro
              </h2>
            </div>
          </header>
          <main className='flex flex-1 justify-center py-5 sm:py-10 px-4 sm:px-6 lg:px-8'>
            <div className='layout-content-container flex flex-col w-full max-w-5xl flex-1'>
              <div className='flex flex-col lg:flex-row lg:gap-12'>
                <div className='w-full lg:w-2/5 flex flex-col gap-8 mb-8 lg:mb-0'>
                  <div className='flex flex-wrap justify-between gap-3'>
                    <div className='flex flex-col gap-3'>
                      <p className='text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
                        Agendar Serviço
                      </p>
                      <p className='text-slate-400 text-base font-normal leading-normal'>
                        Preencha os detalhes abaixo para confirmar seu
                        agendamento.
                      </p>
                    </div>
                  </div>
                  {service && (
                    <Card className='p-4 @container border border-slate-800 rounded-xl bg-slate-900/50'>
                      <div className='flex flex-col items-stretch justify-start rounded-lg'>
                        <div className='w-full bg-center bg-no-repeat aspect-video bg-cover rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center'>
                          <div className='text-primary/40 text-4xl'>📋</div>
                        </div>
                        <div className='flex w-full grow flex-col items-stretch justify-center gap-2 pt-4'>
                          <p className='text-white text-lg font-bold leading-tight tracking-[-0.015em]'>
                            {service.name}
                          </p>
                          <p className='text-slate-400 text-base font-normal leading-normal'>
                            {service.description ||
                              'Descrição do serviço não disponível.'}
                          </p>
                          <div className='flex items-center gap-4 text-slate-400 text-sm mt-2'>
                            <div className='flex items-center gap-1'>
                              <Clock className='w-4 h-4' />
                              <span>Duração: {service.duration} min</span>
                            </div>
                            <div className='flex items-center gap-1'>
                              <span>
                                Preço: R${' '}
                                {typeof service.price === 'number'
                                  ? service.price.toFixed(2).replace('.', ',')
                                  : parseFloat(service.price)
                                      .toFixed(2)
                                      .replace('.', ',')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                  {technician && (
                    <div className='border-t border-slate-800 pt-6'>
                      <div className='flex items-center gap-4 bg-transparent min-h-14 justify-between'>
                        <div className='flex items-center gap-4'>
                          <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full h-12 w-12 bg-primary/20'></div>
                          <div className='flex flex-col'>
                            <p className='text-white text-base font-medium leading-normal flex-1 truncate'>
                              {technician.name}
                            </p>
                            <p className='text-slate-400 text-sm'>
                              Seu técnico especialista
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Card className='w-full lg:w-3/5 bg-slate-900/50 border border-slate-800 rounded-xl p-6 sm:p-8'>
                  <form onSubmit={handleSubmit} className='flex flex-col gap-8'>
                    <div className='flex flex-col gap-4'>
                      <h2 className='text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                        Escolha uma data e horário
                      </h2>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        <div>
                          <Label
                            className='block text-sm font-medium text-slate-300 mb-2'
                            htmlFor='date'
                          >
                            Data
                          </Label>
                          <div className='relative'>
                            <Input
                              className='block w-full rounded-lg border-slate-700 bg-slate-900 shadow-sm focus:border-primary focus:ring-primary sm:text-sm text-slate-100'
                              id='date'
                              name='date'
                              type='date'
                              value={selectedDate}
                              onChange={(e) => {
                                setSelectedDate(e.target.value);
                                setSelectedTime(''); // Limpar hora selecionada ao mudar data
                              }}
                              min={new Date().toISOString().split('T')[0]}
                              required
                            />
                          </div>
                        </div>
                        <div className='flex flex-col'>
                          <Label
                            className='block text-sm font-medium text-slate-300 mb-2'
                            htmlFor='time'
                          >
                            Horário
                          </Label>
                          {slotsLoading ? (
                            <div className='text-slate-400 text-sm'>
                              Carregando horários...
                            </div>
                          ) : availableTimes.length === 0 ? (
                            <div className='text-slate-400 text-sm'>
                              {selectedDate
                                ? 'Nenhum horário disponível para esta data'
                                : 'Selecione uma data para ver os horários disponíveis'}
                            </div>
                          ) : (
                            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                              {availableTimes.map((time) => (
                                <Button
                                  key={time}
                                  type='button'
                                  variant={
                                    selectedTime === time
                                      ? 'default'
                                      : 'outline'
                                  }
                                  className={`px-3 py-2 text-sm text-center ${
                                    selectedTime === time
                                      ? 'text-white bg-primary rounded-md ring-2 ring-primary/50'
                                      : 'text-slate-300 bg-slate-800 rounded-md hover:bg-slate-700'
                                  }`}
                                  onClick={() => setSelectedTime(time)}
                                >
                                  {time}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='border-t border-slate-800'></div>
                    <div className='flex flex-col gap-4'>
                      <h2 className='text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                        Seus dados
                      </h2>
                      <div className='grid grid-cols-1 gap-4'>
                        <div>
                          <Label
                            className='block text-sm font-medium text-slate-300'
                            htmlFor='full-name'
                          >
                            Nome Completo
                          </Label>
                          <div className='mt-1'>
                            <Input
                              className='block w-full rounded-lg border-slate-700 bg-slate-900 shadow-sm focus:border-primary focus:ring-primary sm:text-sm text-slate-100'
                              id='full-name'
                              name='full-name'
                              placeholder='Seu nome completo'
                              type='text'
                              value={formData.fullName}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  fullName: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label
                            className='block text-sm font-medium text-slate-300'
                            htmlFor='email'
                          >
                            E-mail
                          </Label>
                          <div className='mt-1'>
                            <Input
                              className='block w-full rounded-lg border-slate-700 bg-slate-900 shadow-sm focus:border-primary focus:ring-primary sm:text-sm text-slate-100'
                              id='email'
                              name='email'
                              placeholder='voce@exemplo.com'
                              type='email'
                              value={formData.email}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  email: e.target.value,
                                })
                              }
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label
                            className='block text-sm font-medium text-slate-300'
                            htmlFor='phone'
                          >
                            Telefone
                          </Label>
                          <div className='mt-1'>
                            <Input
                              className='block w-full rounded-lg border-slate-700 bg-slate-900 shadow-sm focus:border-primary focus:ring-primary sm:text-sm text-slate-100'
                              id='phone'
                              name='phone'
                              placeholder='(99) 99999-9999'
                              type='tel'
                              value={formData.phone}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  phone: maskPhone(e.target.value),
                                })
                              }
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className='border-t border-slate-800 pt-6'>
                      <Button
                        type='submit'
                        className='flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold leading-6 text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors duration-200'
                        disabled={
                          bookingMutation.isPending ||
                          !selectedDate ||
                          !selectedTime ||
                          !formData.fullName ||
                          !formData.email ||
                          !formData.phone
                        }
                      >
                        <span>
                          {bookingMutation.isPending
                            ? 'Confirmando...'
                            : 'Confirmar Agendamento'}
                        </span>
                        {!bookingMutation.isPending && (
                          <ArrowRight className='w-5 h-5' />
                        )}
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
