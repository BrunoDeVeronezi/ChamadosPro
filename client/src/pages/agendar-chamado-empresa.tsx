import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search, Calendar, Clock, User } from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { maskCurrency } from '@/lib/masks';
import { useAuth } from '@/hooks/use-auth';

interface Technician {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  publicSlug?: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  active: boolean;
}

interface AvailableSlot {
  date: string;
  time: string;
  datetime: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  type: string;
}

export default function AgendarChamadoEmpresa() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedTechnician, setSelectedTechnician] =
    useState<Technician | null>(null);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Dados do formulário
  const [formData, setFormData] = useState({
    finalClient: '',
    serviceAddress: '',
    contactAtLocation: '',
    description: '',
  });

  // Buscar técnicos disponíveis
  const { data: technicians, isLoading: loadingTechnicians } = useQuery<
    Technician[]
  >({
    queryKey: ['/api/technicians'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/technicians', undefined);
      if (!response.ok) throw new Error('Erro ao carregar técnicos');
      return response.json();
    },
  });

  // Buscar serviços do técnico selecionado
  const { data: services, isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ['/api/services', selectedTechnician?.id],
    queryFn: async () => {
      if (!selectedTechnician) return [];
      const response = await apiRequest(
        'GET',
        `/api/technicians/${selectedTechnician.id}/services`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviços');
      return response.json();
    },
    enabled: !!selectedTechnician,
  });

  // Buscar horários disponíveis
  const weekStart = startOfWeek(currentWeek, { locale: ptBR });
  const weekEnd = addDays(weekStart, 6);

  const { data: availableSlots, isLoading: loadingSlots } = useQuery<
    AvailableSlot[]
  >({
    queryKey: [
      '/api/technicians',
      selectedTechnician?.id,
      selectedService?.id,
      weekStart.toISOString(),
      weekEnd.toISOString(),
    ],
    queryFn: async () => {
      if (!selectedTechnician || !selectedService) return [];

      const response = await apiRequest(
        'GET',
        `/api/technicians/${selectedTechnician.id}/available-slots?serviceId=${
          selectedService.id
        }&startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`,
        undefined
      );
      if (!response.ok)
        throw new Error('Erro ao carregar horários disponíveis');
      const data = await response.json();
      return data.slots || [];
    },
    enabled: !!selectedTechnician && !!selectedService,
  });

  // Buscar cliente atual (Empresa/Analista)
  const { data: currentClient } = useQuery<Client>({
    queryKey: ['/api/clients/current'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/clients/current',
        undefined
      );
      if (!response.ok) return null;
      return response.json();
    },
  });

  // Preencher dados do formulário quando cliente for carregado
  useEffect(() => {
    if (currentClient) {
      setFormData((prev) => ({
        ...prev,
        finalClient: currentClient.name || '',
        serviceAddress: currentClient.address || '',
        contactAtLocation: currentClient.phone
          ? `${currentClient.name} - ${currentClient.phone}`
          : '',
      }));
    }
  }, [currentClient]);

  // Filtrar técnicos
  const filteredTechnicians = useMemo(() => {
    if (!technicians) return [];
    if (!technicianSearch.trim()) return technicians;
    const search = technicianSearch.toLowerCase();
    return technicians.filter(
      (t) =>
        t.firstName?.toLowerCase().includes(search) ||
        t.lastName?.toLowerCase().includes(search) ||
        t.email?.toLowerCase().includes(search)
    );
  }, [technicians, technicianSearch]);

  // Agrupar slots por data
  const slotsByDate = useMemo(() => {
    if (!availableSlots) return {};
    const grouped: Record<string, string[]> = {};
    availableSlots.forEach((slot) => {
      const date = slot.date.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      if (!grouped[date].includes(slot.time)) {
        grouped[date].push(slot.time);
      }
    });
    return grouped;
  }, [availableSlots]);

  // Horários disponíveis para a data selecionada
  const availableTimes = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return slotsByDate[dateKey] || [];
  }, [selectedDate, slotsByDate]);

  // Criar agendamento
  const createBookingMutation = useMutation({
    mutationFn: async () => {
      if (
        !selectedTechnician ||
        !selectedService ||
        !selectedDate ||
        !selectedTime
      ) {
        throw new Error('Preencha todos os campos obrigatórios');
      }

      const scheduledDateTime = new Date(
        `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`
      );

      const response = await apiRequest(
        'POST',
        '/api/tickets/company-booking',
        {
          technicianId: selectedTechnician.id,
          serviceId: selectedService.id,
          scheduledDate: scheduledDateTime.toISOString(),
          finalClient: formData.finalClient,
          serviceAddress: formData.serviceAddress,
          contactAtLocation: formData.contactAtLocation,
          description: formData.description,
        }
      );

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
        description: 'O chamado foi agendado com sucesso na fila do técnico.',
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

  const handleConfirm = () => {
    if (
      !selectedTechnician ||
      !selectedService ||
      !selectedDate ||
      !selectedTime
    ) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Por favor, selecione técnico, serviço, data e horário.',
      });
      return;
    }

    if (!formData.finalClient || !formData.serviceAddress) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description:
          'Por favor, preencha Cliente Final e Endereço do Atendimento.',
      });
      return;
    }

    createBookingMutation.mutate();
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className='min-h-screen bg-background-dark p-6'>
      <div className='max-w-7xl mx-auto space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold text-white'>Agendar Chamado</h1>
            <p className='text-gray-400 mt-1'>
              Selecione um técnico, escolha um serviço e horário, e preencha os
              detalhes do chamado.
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => setLocation('/chamados')}
            className='text-white border-gray-700'
          >
            Cancelar
          </Button>
        </div>

        {/* Seção 1: Selecionar Técnico */}
        <Card className='bg-slate-900 border-slate-800'>
          <CardHeader>
            <CardTitle className='text-white'>1. Selecione o Técnico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
              <Input
                placeholder='Buscar técnico...'
                value={technicianSearch}
                onChange={(e) => setTechnicianSearch(e.target.value)}
                className='pl-10 bg-slate-800 border-slate-700 text-white'
              />
            </div>
            {technicianSearch && filteredTechnicians.length > 0 && (
              <div className='mt-2 space-y-1 max-h-60 overflow-y-auto'>
                {filteredTechnicians.map((tech) => (
                  <button
                    key={tech.id}
                    onClick={() => {
                      setSelectedTechnician(tech);
                      setTechnicianSearch(`${tech.firstName} ${tech.lastName}`);
                      setSelectedService(null);
                      setSelectedDate(new Date());
                      setSelectedTime('');
                    }}
                    className='w-full text-left p-2 rounded hover:bg-slate-800 text-white'
                  >
                    {tech.firstName} {tech.lastName} - {tech.email}
                  </button>
                ))}
              </div>
            )}
            {selectedTechnician && (
              <div className='mt-4 p-3 bg-slate-800 rounded flex items-center gap-2'>
                <User className='h-5 w-5 text-primary' />
                <span className='text-white'>
                  {selectedTechnician.firstName} {selectedTechnician.lastName}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção 2: Escolher Serviço e Horário */}
        {selectedTechnician && (
          <Card className='bg-slate-900 border-slate-800'>
            <CardHeader>
              <CardTitle className='text-white'>
                2. Escolha o Serviço e Horário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                {/* Serviços Disponíveis */}
                <div>
                  <h3 className='text-white font-semibold mb-4'>
                    Serviços Disponíveis
                  </h3>
                  {loadingServices ? (
                    <div className='text-gray-400'>Carregando serviços...</div>
                  ) : services && services.length > 0 ? (
                    <div className='space-y-3'>
                      {services
                        .filter((s) => s.active)
                        .map((service) => (
                          <Card
                            key={service.id}
                            className={`cursor-pointer transition-all ${
                              selectedService?.id === service.id
                                ? 'bg-primary/20 border-primary'
                                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                            }`}
                            onClick={() => {
                              setSelectedService(service);
                              setSelectedDate(new Date());
                              setSelectedTime('');
                            }}
                          >
                            <CardContent className='p-4'>
                              <h4 className='text-white font-medium'>
                                {service.name}
                              </h4>
                              {service.description && (
                                <p className='text-gray-400 text-sm mt-1'>
                                  {service.description}
                                </p>
                              )}
                              <div className='flex items-center gap-4 mt-2 text-sm text-gray-400'>
                                <div className='flex items-center gap-1'>
                                  <Clock className='h-4 w-4' />
                                  <span>Duração: {service.duration}h</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                  <span>
                                    Preço:{' '}
                                    {maskCurrency(service.price.toString())}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  ) : (
                    <div className='text-gray-400'>
                      Nenhum serviço disponível
                    </div>
                  )}
                </div>

                {/* Agenda do Técnico */}
                <div>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='text-white font-semibold'>
                      Agenda de {selectedTechnician.firstName}{' '}
                      {selectedTechnician.lastName}
                    </h3>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                        className='text-white border-gray-700'
                      >
                        ←
                      </Button>
                      <span className='text-white text-sm min-w-[200px] text-center'>
                        {format(weekStart, "d 'a' d 'de' MMMM, yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                        className='text-white border-gray-700'
                      >
                        →
                      </Button>
                    </div>
                  </div>

                  {selectedService ? (
                    <>
                      {/* Calendário da Semana */}
                      <div className='grid grid-cols-7 gap-2 mb-4'>
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(
                          (day) => (
                            <div
                              key={day}
                              className='text-center text-gray-400 text-sm font-medium'
                            >
                              {day}
                            </div>
                          )
                        )}
                        {weekDays.map((day) => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const hasSlots = !!slotsByDate[dateKey]?.length;
                          const isSelected =
                            selectedDate && isSameDay(day, selectedDate);
                          const isPast =
                            day < new Date() && !isSameDay(day, new Date());

                          return (
                            <button
                              key={dateKey}
                              onClick={() => {
                                if (!isPast && hasSlots) {
                                  setSelectedDate(day);
                                  setSelectedTime('');
                                }
                              }}
                              disabled={isPast || !hasSlots}
                              className={`p-2 rounded text-sm ${
                                isSelected
                                  ? 'bg-primary text-white'
                                  : hasSlots && !isPast
                                  ? 'bg-slate-800 text-white hover:bg-slate-700'
                                  : 'bg-slate-900 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {format(day, 'd')}
                            </button>
                          );
                        })}
                      </div>

                      {/* Horários Disponíveis */}
                      {selectedDate && availableTimes.length > 0 && (
                        <div>
                          <h4 className='text-white font-medium mb-2'>
                            Horários disponíveis para{' '}
                            {format(selectedDate, "d 'de' MMMM", {
                              locale: ptBR,
                            })}
                          </h4>
                          <div className='grid grid-cols-3 gap-2'>
                            {availableTimes.map((time) => (
                              <Button
                                key={time}
                                variant={
                                  selectedTime === time ? 'default' : 'outline'
                                }
                                size='sm'
                                onClick={() => setSelectedTime(time)}
                                className={
                                  selectedTime === time
                                    ? 'bg-primary text-white'
                                    : 'text-white border-gray-700'
                                }
                              >
                                {time}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedDate && availableTimes.length === 0 && (
                        <div className='text-gray-400 text-sm'>
                          Nenhum horário disponível para esta data
                        </div>
                      )}
                    </>
                  ) : (
                    <div className='text-gray-400 text-center py-8'>
                      Selecione um serviço para ver a agenda
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seção 3: Detalhes do Agendamento */}
        {selectedTechnician &&
          selectedService &&
          selectedDate &&
          selectedTime && (
            <Card className='bg-slate-900 border-slate-800'>
              <CardHeader>
                <CardTitle className='text-white'>
                  3. Detalhes do Agendamento
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <Label htmlFor='finalClient' className='text-white'>
                    Cliente Final
                  </Label>
                  <Input
                    id='finalClient'
                    value={formData.finalClient}
                    onChange={(e) =>
                      setFormData({ ...formData, finalClient: e.target.value })
                    }
                    className='bg-slate-800 border-slate-700 text-white'
                    placeholder='Nome do cliente final'
                  />
                </div>
                <div>
                  <Label htmlFor='serviceAddress' className='text-white'>
                    Endereço do Atendimento
                  </Label>
                  <Input
                    id='serviceAddress'
                    value={formData.serviceAddress}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        serviceAddress: e.target.value,
                      })
                    }
                    className='bg-slate-800 border-slate-700 text-white'
                    placeholder='Endereço completo'
                  />
                </div>
                <div>
                  <Label htmlFor='contactAtLocation' className='text-white'>
                    Contato no Local
                  </Label>
                  <Input
                    id='contactAtLocation'
                    value={formData.contactAtLocation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactAtLocation: e.target.value,
                      })
                    }
                    className='bg-slate-800 border-slate-700 text-white'
                    placeholder='Nome e telefone do contato'
                  />
                </div>
                <div>
                  <Label htmlFor='description' className='text-white'>
                    Descrição do Problema
                  </Label>
                  <Textarea
                    id='description'
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className='bg-slate-800 border-slate-700 text-white'
                    placeholder='Descreva o problema ou serviço necessário'
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          )}

        {/* Seção 4: Revisão e Confirmação */}
        {selectedTechnician &&
          selectedService &&
          selectedDate &&
          selectedTime &&
          formData.finalClient &&
          formData.serviceAddress && (
            <Card className='bg-slate-900 border-slate-800'>
              <CardHeader>
                <CardTitle className='text-white'>
                  4. Revisão e Confirmação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Técnico:</span>
                    <span className='text-white font-medium'>
                      {selectedTechnician.firstName}{' '}
                      {selectedTechnician.lastName}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Serviço:</span>
                    <span className='text-white font-medium'>
                      {selectedService.name}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Data e Hora:</span>
                    <span className='text-white font-medium'>
                      {format(selectedDate, "d 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                      , às {selectedTime}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Cliente:</span>
                    <span className='text-white font-medium'>
                      {formData.finalClient}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-400'>Endereço:</span>
                    <span className='text-white font-medium'>
                      {formData.serviceAddress}
                    </span>
                  </div>
                  <div className='flex justify-between border-t border-slate-700 pt-3 mt-3'>
                    <span className='text-white font-semibold'>
                      Valor Total:
                    </span>
                    <span className='text-white font-bold text-lg'>
                      {maskCurrency(selectedService.price.toString())}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        {/* Botões de Ação */}
        <div className='flex justify-end gap-3'>
          <Button
            variant='outline'
            onClick={() => setLocation('/chamados')}
            className='text-white border-gray-700'
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              !selectedTechnician ||
              !selectedService ||
              !selectedDate ||
              !selectedTime ||
              !formData.finalClient ||
              !formData.serviceAddress ||
              createBookingMutation.isPending
            }
            className='bg-primary hover:bg-primary/90 text-white'
          >
            <Calendar className='w-4 h-4 mr-2' />
            {createBookingMutation.isPending
              ? 'Criando...'
              : 'Confirmar Agendamento'}
          </Button>
        </div>
      </div>
    </div>
  );
}






















