import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CheckCircle2 } from 'lucide-react';
import { addMonths, endOfMonth, startOfMonth } from 'date-fns';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  description: string;
}

interface PublicBookingProps {
  services: Service[];
  userId: string;
  isLoadingServices: boolean;
}

interface AvailableSlot {
  date: string;
  time: string;
  datetime: string;
}

async function fetchAvailableSlots({
  userId,
  serviceId,
  selectedDate,
}: {
  userId: string;
  serviceId: string;
  selectedDate: Date;
}): Promise<AvailableSlot[]> {
  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(selectedDate);
  end.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    userId,
    serviceId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  const res = await fetch(
    `/api/public/booking/available-slots${params.toString()}`
  );

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text);
  }

  const data = await res.json();
  return (data.slots ?? []) as AvailableSlot[];
}

export function PublicBooking({
  services,
  userId,
  isLoadingServices,
}: PublicBookingProps) {
  const [step, setStep] = useState<
    'services' | 'datetime' | 'contact' | 'confirmation'
  >('services');
  const [dateTimeStep, setDateTimeStep] = useState<'selectDate' | 'selectTime'>(
    'selectDate'
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  const {
    data: availableSlots = [],
    isFetching: isFetchingSlots,
    error: availableSlotsError,
    refetch: refetchAvailableSlots,
  } = useQuery<AvailableSlot[]>({
    queryKey: [
      'public-booking-available-slots',
      userId,
      selectedService?.id,
      selectedDate?.toISOString(),
    ],
    queryFn: () => {
      if (!selectedService?.id || !selectedDate) {
        throw new Error('Service or date not selected');
      }
      return fetchAvailableSlots({
        userId: userId as string,
        serviceId: selectedService.id,
        selectedDate: selectedDate,
      });
    },
    enabled: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (step !== 'datetime') {
      return;
    }

    if (!userId || !selectedService || !selectedDate) {
      return;
    }

    void refetchAvailableSlots();
  }, [step, userId, selectedService, selectedDate, refetchAvailableSlots]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedDate, selectedService]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setDateTimeStep('selectDate');
    setStep('datetime');
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (date) {
      setDateTimeStep('selectTime');
    }
  };

  const handleDateTimeConfirm = () => {
    if (selectedSlot) {
      setStep('contact');
    }
  };

  const availableTimes = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const selectedDateIso = selectedDate.toISOString().split('T')[0];
    return availableSlots.filter((slot) => slot.date === selectedDateIso);
  }, [availableSlots, selectedDate]);

  const renderServicesContent = () => {
    if (isLoadingServices) {
      return (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Card key={item}>
              <CardHeader>
                <Skeleton className='h-6 w-3/4' />
                <Skeleton className='h-4 w-1/2 mt-2' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-16 w-full' />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (services.length === 0) {
      return (
        <Card className='max-w-md mx-auto'>
          <CardHeader>
            <CardTitle>Nenhum Servio Disponvel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>
              Cadastre um servio ativo para habilitar o agendamento pblico.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
        {services.map((service) => (
          <Card
            key={service.id}
            className='hover-elevate'
            data-testid={`card-service-${service.id}`}
          >
            <CardHeader>
              <CardTitle className='text-lg'>{service.name}</CardTitle>
              <div className='flex items-center gap-2 mt-2'>
                <Badge variant='outline' className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' />
                  {service.duration}h
                </Badge>
                <Badge className='bg-primary text-primary-foreground'>
                  R${' '}
                  {Number(service.price).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                {service.description}
              </p>
              <Button
                className='w-full'
                onClick={() => handleServiceSelect(service)}
                data-testid='button-select-service'
              >
                Agendar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (step === 'services') {
    return (
      <div className='max-w-5xl mx-auto space-y-6'>
        <div className='text-center space-y-2 mb-8'>
          <h1 className='text-4xl font-bold'>Agende seu Servio</h1>
          <p className='text-lg text-muted-foreground'>
            Escolha o servio desejado e encontre o melhor horrio para voc
          </p>
        </div>

        {renderServicesContent()}

        <Card className='mt-8'>
          <CardContent className='p-6'>
            <h3 className='font-semibold mb-2'>Poltica de Cancelamento</h3>
            <p className='text-sm text-muted-foreground'>
              Cancelamentos podem ser feitos at 24 horas antes do horrio
              agendado. Cancelamentos com menos de 24 horas de antecedncia podem
              estar sujeitos a cobrana.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'datetime') {
    if (!selectedService) {
      return (
        <div className='max-w-3xl mx-auto space-y-6'>
          <Card>
            <CardContent className='p-6 text-center'>
              <p className='text-muted-foreground'>Serviço não selecionado</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className='max-w-3xl mx-auto space-y-6'>
        <div className='text-center space-y-2'>
          <h2 className='text-3xl font-bold'>
            {dateTimeStep === 'selectDate'
              ? 'Escolha a Data'
              : 'Escolha o Horário'}
          </h2>
          <p className='text-muted-foreground'>
            {selectedService.name} - R${' '}
            {selectedService.price.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>

        <Card>
          <CardContent className='p-6'>
            {dateTimeStep === 'selectDate' ? (
              <div className='space-y-4'>
                <div className='flex justify-center'>
                  <Calendar
                    mode='single'
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    className='rounded-md border'
                  />
                </div>

                <div className='flex gap-3'>
                  <Button
                    variant='outline'
                    onClick={() => setStep('services')}
                    data-testid='button-back'
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='space-y-2'>
                  {isFetchingSlots ? (
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                      {[1, 2, 3, 4, 5, 6].map((item) => (
                        <Skeleton key={item} className='h-12 w-full' />
                      ))}
                    </div>
                  ) : availableSlotsError ? (
                    <p className='text-sm text-destructive text-center py-8'>
                      No foi possvel carregar os horrios. Tente novamente mais
                      tarde.
                    </p>
                  ) : availableTimes.length === 0 ? (
                    <p className='text-sm text-muted-foreground text-center py-8'>
                      No h horrios disponveis nesta data. Escolha outra data.
                    </p>
                  ) : (
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                      {availableTimes.map((slot) => (
                        <Button
                          key={slot.datetime}
                          variant={
                            selectedSlot?.datetime === slot.datetime
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => setSelectedSlot(slot)}
                          className='h-12'
                          data-testid={`button-time-${slot.time}`}
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className='flex gap-3 mt-6'>
                  <Button
                    variant='outline'
                    onClick={() => setDateTimeStep('selectDate')}
                    data-testid='button-back'
                    className='min-w-[120px]'
                  >
                    ← Voltar
                  </Button>
                  <Button
                    className='flex-1'
                    onClick={handleDateTimeConfirm}
                    disabled={!selectedSlot}
                    data-testid='button-continue'
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'contact') {
    return (
      <div className='max-w-2xl mx-auto space-y-6'>
        <div className='text-center space-y-2'>
          <h2 className='text-3xl font-bold'>Seus Dados</h2>
          <p className='text-muted-foreground'>
            Precisamos de algumas informaes para confirmar
          </p>
        </div>

        <Card>
          <CardContent className='p-6 space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Nome Completo</Label>
              <Input
                id='name'
                placeholder='Seu nome'
                data-testid='input-booking-name'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='email'>E-mail</Label>
              <Input
                id='email'
                type='email'
                placeholder='seu@email.com'
                data-testid='input-booking-email'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='phone'>Telefone</Label>
              <Input
                id='phone'
                placeholder='(00) 00000-0000'
                data-testid='input-booking-phone'
              />
            </div>

            <div className='flex gap-3 mt-6'>
              <Button
                variant='outline'
                onClick={() => setStep('datetime')}
                data-testid='button-back'
              >
                Voltar
              </Button>
              <Button
                className='flex-1'
                onClick={() => setStep('confirmation')}
                data-testid='button-confirm-booking'
              >
                Confirmar Agendamento
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedService) {
    return (
      <div className='max-w-2xl mx-auto'>
        <Card>
          <CardContent className='p-12 text-center'>
            <p className='text-muted-foreground'>Serviço não selecionado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='max-w-2xl mx-auto'>
      <Card>
        <CardContent className='p-12 text-center space-y-4'>
          <div className='mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center'>
            <CheckCircle2 className='h-8 w-8 text-green-600 dark:text-green-400' />
          </div>
          <h2 className='text-3xl font-bold'>Agendamento Confirmado!</h2>
          <p className='text-muted-foreground'>
            Voc receber um e-mail de confirmao com todos os detalhes do seu
            agendamento. Um lembrete ser enviado 24 horas e 1 hora antes do
            horrio marcado.
          </p>
          <div className='bg-muted/50 rounded-lg p-4 text-left space-y-2 mt-6'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Servio:</span>
              <span className='font-semibold'>{selectedService.name}</span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Data:</span>
              <span className='font-semibold'>
                {selectedSlot
                  ? new Date(selectedSlot.datetime).toLocaleDateString('pt-BR')
                  : selectedDate?.toLocaleDateString('pt-BR') ||
                    'Não informado'}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Horrio:</span>
              <span className='font-semibold'>
                {selectedSlot?.time || 'Não informado'}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Valor:</span>
              <span className='font-semibold'>
                R${' '}
                {selectedService.price.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
