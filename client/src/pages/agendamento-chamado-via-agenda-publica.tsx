import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search, ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';
import { maskPhone } from '@/lib/masks';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Technician {
  id: string;
  name: string;
  email: string;
}

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}

export default function AgendamentoChamadoViaAgendaPublica() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTechnician, setSelectedTechnician] =
    useState<Technician | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    clientName: 'ACME Corporation',
    address: 'Av. Paulista, 1500',
    contactPerson: 'Maria Souza - (11) 98765-4321',
    problemDescription: 'Ar condicionado da sala de reuniões não está gelando.',
  });

  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ['/api/technicians/partners'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/technicians/partners',
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar técnicos');
      return response.json();
    },
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/services', undefined);
      if (!response.ok) throw new Error('Erro ao carregar serviços');
      return response.json();
    },
  });

  const weekStart = startOfWeek(currentWeek, { locale: ptBR });
  const weekEnd = endOfWeek(currentWeek, { locale: ptBR });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const availableTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (
        !selectedTechnician ||
        !selectedService ||
        !selectedDate ||
        !selectedTime
      ) {
        throw new Error('Preencha todos os campos obrigatórios');
      }
      const response = await apiRequest('POST', '/api/tickets', {
        technicianId: selectedTechnician.id,
        serviceId: selectedService.id,
        scheduledFor: `${format(
          selectedDate,
          'yyyy-MM-dd'
        )}T${selectedTime}:00`,
        clientName: formData.clientName,
        address: formData.address,
        contactPerson: formData.contactPerson,
        description: formData.problemDescription,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar agendamento');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: 'Agendamento criado',
        description: 'O chamado foi agendado com sucesso.',
      });
      setLocation('/chamados');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar agendamento',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    bookingMutation.mutate();
  };

  return (
    <div className='font-display bg-background-light dark:bg-background-dark'>
      <div className='relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden'>
        <div className='layout-container flex h-full grow flex-col'>
          <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#f0f2f5] dark:border-b-background-dark/50 px-10 py-3 bg-white dark:bg-background-dark'>
            <div className='flex items-center gap-4 text-[#111418] dark:text-white'>
              <div className='size-6 text-primary'>
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
              <h2 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]'>
                ChamadosPro
              </h2>
            </div>
            <div className='flex flex-1 justify-end gap-8'>
              <div className='flex items-center gap-9'>
                <a
                  className='text-primary text-sm font-medium leading-normal'
                  href='#'
                >
                  Dashboard
                </a>
                <a
                  className='text-[#111418] dark:text-white/80 text-sm font-medium leading-normal'
                  href='#'
                >
                  Chamados
                </a>
                <a
                  className='text-[#111418] dark:text-white/80 text-sm font-medium leading-normal'
                  href='#'
                >
                  Técnicos
                </a>
                <a
                  className='text-[#111418] dark:text-white/80 text-sm font-medium leading-normal'
                  href='#'
                >
                  Clientes
                </a>
                <a
                  className='text-[#111418] dark:text-white/80 text-sm font-medium leading-normal'
                  href='#'
                >
                  Relatórios
                </a>
              </div>
              <div className='flex gap-2'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='bg-[#f0f2f5] dark:bg-white/10'
                >
                  <span>🔔</span>
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='bg-[#f0f2f5] dark:bg-white/10'
                >
                  <span>⚙️</span>
                </Button>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
              </div>
            </div>
          </header>
          <main className='px-40 flex flex-1 justify-center py-5'>
            <div className='layout-content-container flex flex-col max-w-[960px] flex-1'>
              <div className='flex flex-wrap gap-2 p-4'>
                <a
                  className='text-[#60708a] dark:text-white/60 text-base font-medium leading-normal'
                  href='#'
                >
                  Início
                </a>
                <span className='text-[#60708a] dark:text-white/60 text-base font-medium leading-normal'>
                  /
                </span>
                <a
                  className='text-[#60708a] dark:text-white/60 text-base font-medium leading-normal'
                  href='#'
                >
                  Chamados
                </a>
                <span className='text-[#60708a] dark:text-white/60 text-base font-medium leading-normal'>
                  /
                </span>
                <span className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
                  // Novo Agendamento
                </span>
              </div>
              <div className='flex flex-wrap justify-between gap-3 p-4'>
                <div className='flex min-w-72 flex-col gap-3'>
                  <p className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
                    Agendar Chamado
                  </p>
                  <p className='text-[#60708a] dark:text-white/70 text-base font-normal leading-normal'>
                    Selecione um técnico, escolha um serviço e horário, e
                    preencha os detalhes do chamado.
                  </p>
                </div>
              </div>
              <form onSubmit={handleSubmit} className='flex flex-col gap-6 p-4'>
                {/* Step 1 */}
                <Card className='flex flex-col gap-3 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-background-dark p-6'>
                  <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                    1. Selecione o Técnico
                  </h2>
                  <div className='py-3'>
                    <Label
                      className='text-sm font-medium text-slate-700 dark:text-white/80 mb-2 block'
                      htmlFor='tech-search'
                    >
                      Técnico Parceiro
                    </Label>
                    <div className='relative'>
                      <div className='text-[#60708a] dark:text-white/60 absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none'>
                        <Search className='w-5 h-5' />
                      </div>
                      <Input
                        className='form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-stone-300 dark:border-white/20 bg-background-light dark:bg-white/5 h-12 placeholder:text-[#60708a] dark:placeholder:text-white/60 pl-12 text-base font-normal leading-normal'
                        id='tech-search'
                        placeholder='Comece a digitar o nome do técnico para buscar...'
                        value={selectedTechnician?.name || ''}
                        onChange={(e) => {
                          const tech = technicians?.find((t) =>
                            t.name
                              .toLowerCase()
                              .includes(e.target.value.toLowerCase())
                          );
                          if (tech) setSelectedTechnician(tech);
                        }}
                      />
                    </div>
                  </div>
                </Card>

                {/* Step 2 */}
                <Card className='flex flex-col gap-6 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-background-dark p-6'>
                  <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                    2. Escolha o Serviço e Horário
                  </h2>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                    <div className='flex flex-col gap-4'>
                      <h3 className='text-lg font-semibold text-slate-800 dark:text-white'>
                        Serviços Disponíveis
                      </h3>
                      <div className='flex flex-col gap-3'>
                        {services?.map((service) => (
                          <div
                            key={service.id}
                            className={`flex justify-between items-center p-4 rounded-lg border cursor-pointer ${
                              selectedService?.id === service.id
                                ? 'border-2 border-primary bg-primary/10 dark:bg-primary/20'
                                : 'border-stone-200 dark:border-white/20 hover:bg-stone-50 dark:hover:bg-white/5'
                            }`}
                            onClick={() => setSelectedService(service)}
                          >
                            <div>
                              <p
                                className={`font-medium ${
                                  selectedService?.id === service.id
                                    ? 'text-primary dark:text-white'
                                    : 'text-slate-800 dark:text-white'
                                }`}
                              >
                                {service.name}
                              </p>
                              <p
                                className={`text-sm ${
                                  selectedService?.id === service.id
                                    ? 'text-primary/80 dark:text-white/80'
                                    : 'text-slate-500 dark:text-white/60'
                                }`}
                              >
                                Duração: {service.duration} horas
                              </p>
                            </div>
                            <p
                              className={`font-semibold ${
                                selectedService?.id === service.id
                                  ? 'text-primary dark:text-white'
                                  : 'text-slate-800 dark:text-white'
                              }`}
                            >
                              R$ {service.price.toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className='flex flex-col gap-4'>
                      <h3 className='text-lg font-semibold text-slate-800 dark:text-white'>
                        Agenda de {selectedTechnician?.name || 'Técnico'}
                      </h3>
                      <Card className='p-4 rounded-lg border border-stone-200 dark:border-white/10'>
                        <div className='flex items-center justify-between mb-4'>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() =>
                              setCurrentWeek(subWeeks(currentWeek, 1))
                            }
                            className='p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/10'
                          >
                            <ChevronLeft className='w-5 h-5 text-slate-500 dark:text-white/60' />
                          </Button>
                          <p className='font-semibold text-slate-700 dark:text-white'>
                            {format(weekStart, 'd', { locale: ptBR })} a{' '}
                            {format(weekEnd, "d 'de' MMMM, yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() =>
                              setCurrentWeek(addWeeks(currentWeek, 1))
                            }
                            className='p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/10'
                          >
                            <ChevronRight className='w-5 h-5 text-slate-500 dark:text-white/60' />
                          </Button>
                        </div>
                        <div className='grid grid-cols-7 gap-2 text-center text-sm'>
                          {[
                            'Dom',
                            'Seg',
                            'Ter',
                            'Qua',
                            'Qui',
                            'Sex',
                            'Sáb',
                          ].map((day) => (
                            <div
                              key={day}
                              className='text-slate-500 dark:text-white/60'
                            >
                              {day}
                            </div>
                          ))}
                          {weekDays.map((day) => {
                            const isSelected =
                              selectedDate && isSameDay(day, selectedDate);
                            const isPast = day < new Date();
                            return (
                              <button
                                key={day.toISOString()}
                                type='button'
                                className={`p-2 rounded-lg ${
                                  isSelected
                                    ? 'bg-primary text-white font-semibold cursor-pointer'
                                    : isPast
                                    ? 'text-slate-400 dark:text-white/40 bg-stone-50 dark:bg-white/5'
                                    : 'hover:bg-stone-100 dark:hover:bg-white/10 cursor-pointer'
                                }`}
                                onClick={() => !isPast && setSelectedDate(day)}
                                disabled={isPast}
                              >
                                {format(day, 'd')}
                              </button>
                            );
                          })}
                        </div>
                      </Card>
                      <div className='grid grid-cols-3 gap-2'>
                        {availableTimes.map((time) => (
                          <Button
                            key={time}
                            type='button'
                            variant={
                              selectedTime === time ? 'default' : 'outline'
                            }
                            className={`px-4 py-2 text-center rounded-lg ${
                              selectedTime === time
                                ? 'border-2 border-primary bg-primary/10 dark:bg-primary/20 text-primary dark:text-white font-semibold'
                                : 'border border-stone-200 dark:border-white/20 text-slate-600 dark:text-white/70 hover:border-primary dark:hover:border-primary'
                            }`}
                            onClick={() => setSelectedTime(time)}
                            disabled={time === '15:00'}
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Step 3 */}
                <Card className='flex flex-col gap-3 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-background-dark p-6'>
                  <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                    3. Detalhes do Agendamento
                  </h2>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-3'>
                    <div className='col-span-1 md:col-span-2'>
                      <Label
                        className='text-sm font-medium text-slate-700 dark:text-white/80 mb-2 block'
                        htmlFor='client-name'
                      >
                        Cliente Final
                      </Label>
                      <Input
                        className='form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-stone-300 dark:border-white/20 bg-background-light dark:bg-white/5 h-12 placeholder:text-[#60708a] dark:placeholder:text-white/60 px-4 text-base font-normal leading-normal'
                        id='client-name'
                        placeholder='Selecione um cliente ou adicione um novo'
                        value={formData.clientName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            clientName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label
                        className='text-sm font-medium text-slate-700 dark:text-white/80 mb-2 block'
                        htmlFor='address'
                      >
                        Endereço do Atendimento
                      </Label>
                      <Input
                        className='form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-stone-300 dark:border-white/20 bg-background-light dark:bg-white/5 h-12 placeholder:text-[#60708a] dark:placeholder:text-white/60 px-4 text-base font-normal leading-normal'
                        id='address'
                        placeholder='Ex: Rua das Flores, 123'
                        type='text'
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label
                        className='text-sm font-medium text-slate-700 dark:text-white/80 mb-2 block'
                        htmlFor='contact-person'
                      >
                        Contato no Local
                      </Label>
                      <Input
                        className='form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-stone-300 dark:border-white/20 bg-background-light dark:bg-white/5 h-12 placeholder:text-[#60708a] dark:placeholder:text-white/60 px-4 text-base font-normal leading-normal'
                        id='contact-person'
                        placeholder='Nome e telefone'
                        type='text'
                        value={formData.contactPerson}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactPerson: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className='col-span-1 md:col-span-2'>
                      <Label
                        className='text-sm font-medium text-slate-700 dark:text-white/80 mb-2 block'
                        htmlFor='problem-description'
                      >
                        Descrição do Problema
                      </Label>
                      <Textarea
                        className='form-textarea w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#111418] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border-stone-300 dark:border-white/20 bg-background-light dark:bg-white/5 placeholder:text-[#60708a] dark:placeholder:text-white/60 px-4 py-3 text-base font-normal leading-normal'
                        id='problem-description'
                        placeholder='Descreva brevemente o problema a ser resolvido...'
                        rows={3}
                        value={formData.problemDescription}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            problemDescription: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </Card>

                {/* Step 4 */}
                <Card className='flex flex-col gap-3 rounded-xl border border-stone-200 dark:border-white/10 bg-white dark:bg-background-dark p-6'>
                  <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                    4. Revisão e Confirmação
                  </h2>
                  <div className='space-y-4 pt-3 text-slate-700 dark:text-white/80'>
                    <div className='flex justify-between items-center'>
                      <span className='text-slate-500 dark:text-white/60'>
                        Técnico:
                      </span>
                      <span className='font-semibold'>
                        {selectedTechnician?.name || 'Não selecionado'}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-slate-500 dark:text-white/60'>
                        Serviço:
                      </span>
                      <span className='font-semibold'>
                        {selectedService?.name || 'Não selecionado'}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-slate-500 dark:text-white/60'>
                        Data e Hora:
                      </span>
                      <span className='font-semibold'>
                        {selectedDate && selectedTime
                          ? `${format(selectedDate, "d 'de' MMMM, yyyy", {
                              locale: ptBR,
                            })}, às ${selectedTime}`
                          : 'Não selecionado'}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-slate-500 dark:text-white/60'>
                        Cliente:
                      </span>
                      <span className='font-semibold'>
                        {formData.clientName}
                      </span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-slate-500 dark:text-white/60'>
                        Endereço:
                      </span>
                      <span className='font-semibold'>{formData.address}</span>
                    </div>
                    <div className='flex justify-between items-center'>
                      <span className='text-slate-500 dark:text-white/60'>
                        Valor Total:
                      </span>
                      <span className='font-bold text-lg text-primary'>
                        {selectedService
                          ? `R$ ${selectedService.price
                              .toFixed(2)
                              .replace('.', ',')}`
                          : 'R$ 0,00'}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* CTA */}
                <div className='flex justify-end gap-4 p-4'>
                  <Button
                    type='button'
                    variant='outline'
                    className='flex items-center justify-center rounded-lg h-12 bg-stone-200 dark:bg-white/10 px-6 text-sm font-bold text-slate-700 dark:text-white/80'
                    onClick={() => setLocation('/chamados')}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type='submit'
                    className='flex items-center justify-center rounded-lg h-12 bg-primary px-6 text-sm font-bold text-white gap-2'
                    disabled={bookingMutation.isPending}
                  >
                    <CalendarCheck className='w-5 h-5' />
                    Confirmar Agendamento
                  </Button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}























