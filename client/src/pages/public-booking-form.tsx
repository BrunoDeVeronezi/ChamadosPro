import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Calendar as CalendarIcon, Clock, DollarSign, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ptBR } from "date-fns/locale";
import { addMonths, endOfMonth, startOfMonth, format } from "date-fns";

interface Service {
  id: string;
  name: string;
  description: string;
  price: string;
  duration: number;
}

import { fetchPublicAvailableSlots, type AvailableSlot } from "@/lib/public-booking";

export default function PublicBookingForm() {
  const [, params] = useRoute("/:publicSlug/service/:serviceId");
  const publicSlug = params.publicSlug;
  const serviceId = params.serviceId;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [step, setStep] = useState<'date' | 'info' | 'success'>('date');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));

  const dateRange = useMemo(() => {
    const rangeStart = startOfMonth(currentMonth);
    const rangeEnd = endOfMonth(addMonths(currentMonth, 1));
    return { rangeStart, rangeEnd };
  }, [currentMonth]);

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    clientCity: '',
    clientState: '',
    clientType: 'PF' as 'PF' | 'PJ',
    description: '',
  });

  const { data: service, isLoading: serviceLoading } = useQuery<Service>({
    queryKey: ["/api/public/services", publicSlug, serviceId],
    enabled: !!publicSlug && !!serviceId,
  });

  const {
    data: slots = [],
    isFetching: slotsLoading,
    error: slotsError,
  } = useQuery<AvailableSlot[]>({
    queryKey: [
      "public-booking-available-slots",
      publicSlug,
      serviceId,
      dateRange.rangeStart.toISOString(),
      dateRange.rangeEnd.toISOString(),
    ],
    queryFn: () =>
      fetchPublicAvailableSlots({
        userSlug: publicSlug as string,
        serviceId: serviceId as string,
        startDate: dateRange.rangeStart,
        endDate: dateRange.rangeEnd,
      }),
    enabled: !!publicSlug && !!serviceId && step === 'date',
    staleTime: 0,
  });

  const bookingMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/public/booking/request", data);
    },
    onSuccess: () => {
      setStep('success');
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao agendar",
        description: error.message || "No foi possvel completar o agendamento. Tente novamente.",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlot || !service) return;

    await bookingMutation.mutateAsync({
      userSlug: publicSlug as string,
      serviceId,
      scheduledDate: selectedSlot.datetime,
      ...formData,
    });
  };

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const availableDatesSet = useMemo(() => new Set(slots.map((slot) => slot.date)), [slots]);

  const availableTimes = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    const iso = selectedDate.toISOString().split('T')[0];
    return slots.filter((slot) => slot.date === iso);
  }, [slots, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  if (!publicSlug || !serviceId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Link Invlido</CardTitle>
            <CardDescription>
              Este link de agendamento no  vlido.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (serviceLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Serviço Não Encontrado</CardTitle>
            <CardDescription>
              O serviço solicitado não está disponível.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Agendamento Realizado!</CardTitle>
            <CardDescription className="text-base">
              Seu agendamento foi confirmado. Voc receber um e-mail com os detalhes e lembretes antes do horrio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Serviço</span>
                <span className="text-sm font-medium">{service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Data e Hora</span>
                <span className="text-sm font-medium">
                  {selectedSlot && format(new Date(selectedSlot.datetime), "dd/MM/yyyy 's' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Duração</span>
                <span className="text-sm font-medium">{service.duration}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor</span>
                <span className="text-sm font-medium">
                  R$ {parseFloat(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            
            <Button
              className="w-full"
              onClick={() => navigate(`/${publicSlug}`)}
              data-testid="button-back-to-services"
            >
              Voltar para Serviços
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href={`/${publicSlug}`}>
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Service Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-service-name">{service.name}</CardTitle>
            <div className="flex items-center gap-6 mt-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">{service.duration}h</span>
              </div>
              <div className="flex items-center gap-2 text-primary font-semibold">
                <DollarSign className="w-5 h-5" />
                <span>R$ {parseFloat(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Booking Form */}
        {step === 'date' && (
          <div className="grid md:grid-cols-2 gap-8">
            {/* Calendar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Escolha a Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  month={currentMonth}
                  onSelect={handleDateSelect}
                  onMonthChange={(month) => month && setCurrentMonth(startOfMonth(month))}
                  disabled={(date) => {
                    const normalized = new Date(date);
                    normalized.setHours(0, 0, 0, 0);

                    if (normalized < today) {
                      return true;
                    }

                    if (normalized > dateRange.rangeEnd) {
                      return true;
                    }

                    if (normalized.getDay() === 0) {
                      return true;
                    }

                    if (!publicSlug) {
                      return false;
                    }

                    if (slotsLoading) {
                      return false;
                    }

                    const iso = normalized.toISOString().split('T')[0];
                    return !availableDatesSet.has(iso);
                  }}
                  locale={ptBR}
                  className="rounded-md border"
                  data-testid="calendar-date-picker"
                />
              </CardContent>
            </Card>

            {/* Time Slots */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Horrios Disponveis
                </CardTitle>
                {selectedDate && (
                  <CardDescription>
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedDate ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Selecione uma data para ver os horrios disponveis
                  </p>
                ) : slotsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : slotsError ? (
                  <p className="text-sm text-destructive text-center py-8">
                    No foi possvel carregar os horrios. Tente novamente mais tarde.
                  </p>
                ) : availableTimes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No h horrios disponveis para esta data
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableTimes.map((slot) => (
                      <Button
                        key={slot.datetime}
                        variant={selectedSlot.datetime === slot.datetime ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => setSelectedSlot(slot)}
                        data-testid={`button-slot-${slot.time}`}
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'date' && selectedSlot && (
          <div className="mt-8 flex justify-end">
            <Button 
              size="lg" 
              onClick={() => setStep('info')}
              data-testid="button-continue"
            >
              Continuar
            </Button>
          </div>
        )}

        {step === 'info' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seus Dados</CardTitle>
                <CardDescription>
                  Preencha suas informações para confirmar o agendamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Client Type */}
                <div className="space-y-2">
                  <Label>Tipo de Cliente</Label>
                  <RadioGroup
                    value={formData.clientType}
                    onValueChange={(value: 'PF' | 'PJ') => setFormData({ ...formData, clientType: value })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PF" id="pf" data-testid="radio-pf" />
                      <Label htmlFor="pf" className="font-normal">Pessoa Fsica</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PJ" id="pj" data-testid="radio-pj" />
                      <Label htmlFor="pj" className="font-normal">Pessoa Jurdica</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome {formData.clientType === 'PJ' && 'da Empresa'} *</Label>
                  <Input
                    id="name"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    required
                    data-testid="input-name"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    required
                    data-testid="input-phone"
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Endereo</Label>
                  <Input
                    id="address"
                    value={formData.clientAddress}
                    onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                    data-testid="input-address"
                  />
                </div>

                {/* City and State */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={formData.clientCity}
                      onChange={(e) => setFormData({ ...formData, clientCity: e.target.value })}
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={formData.clientState}
                      onChange={(e) => setFormData({ ...formData, clientState: e.target.value })}
                      maxLength={2}
                      placeholder="SP"
                      data-testid="input-state"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Observaes (opcional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    data-testid="input-description"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Agendamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Serviço</span>
                  <span className="text-sm font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data e Hora</span>
                  <span className="text-sm font-medium">
                    {selectedSlot && format(new Date(selectedSlot.datetime), "dd/MM/yyyy 's' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Duração</span>
                  <span className="text-sm font-medium">{service.duration}h</span>
                </div>
                <div className="flex justify-between pt-3 border-t">
                  <span className="font-semibold">Valor Total</span>
                  <span className="font-semibold text-primary">
                    R$ {parseFloat(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('date')}
                data-testid="button-back-to-date"
              >
                Voltar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={bookingMutation.isPending}
                data-testid="button-confirm"
              >
                {bookingMutation.isPending ? 'Confirmando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
