import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Calculator, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SLOT_INTERVAL_MINUTES = 30;
const DEFAULT_DAY_START = '08:00';
const DEFAULT_DAY_END = '18:00';
const DEFAULT_BREAK_START = '12:00';
const DEFAULT_BREAK_END = '13:00';
const buildTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  for (
    let minute = startMinutes;
    minute < endMinutes;
    minute += SLOT_INTERVAL_MINUTES
  ) {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    slots.push(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    );
  }
  return slots;
};
const ALL_TIME_SLOTS = buildTimeSlots(0, 24);
const ALL_TIME_SLOTS_SET = new Set(ALL_TIME_SLOTS);

type WorkingDayConfig = {
  enabled: boolean;
  start: string;
  end: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
};

type WorkingHoursConfig = {
  days: Record<number, WorkingDayConfig>;
};

const DEFAULT_DAY_CONFIG: WorkingDayConfig = {
  enabled: false,
  start: DEFAULT_DAY_START,
  end: DEFAULT_DAY_END,
  breakEnabled: false,
  breakStart: DEFAULT_BREAK_START,
  breakEnd: DEFAULT_BREAK_END,
};

const createWorkingHoursConfig = (enabledDays: number[]) => {
  const days: Record<number, WorkingDayConfig> = {};
  for (let day = 0; day <= 6; day += 1) {
    const isEnabled = enabledDays.includes(day);
    days[day] = {
      ...DEFAULT_DAY_CONFIG,
      enabled: isEnabled,
    };
  }
  return { days };
};

const getSlotIndex = (slot: string) => ALL_TIME_SLOTS.indexOf(slot);

const normalizeTimeSlot = (slot: string | undefined, fallback: string) =>
  slot && ALL_TIME_SLOTS_SET.has(slot) ? slot : fallback;

const normalizeDayConfig = (
  config: Partial<WorkingDayConfig> | undefined,
  fallbackEnabled: boolean
): WorkingDayConfig => {
  const enabled = config?.enabled ?? fallbackEnabled;
  const start = normalizeTimeSlot(config?.start, DEFAULT_DAY_CONFIG.start);
  const end = normalizeTimeSlot(config?.end, DEFAULT_DAY_CONFIG.end);
  let startIndex = getSlotIndex(start);
  let endIndex = getSlotIndex(end);

  if (startIndex < 0) {
    startIndex = getSlotIndex(DEFAULT_DAY_CONFIG.start);
  }
  if (endIndex < 0) {
    endIndex = getSlotIndex(DEFAULT_DAY_CONFIG.end);
  }
  if (endIndex <= startIndex) {
    endIndex = Math.min(startIndex + 1, ALL_TIME_SLOTS.length - 1);
  }

  let breakEnabled = config?.breakEnabled ?? false;
  const breakStart = normalizeTimeSlot(
    config?.breakStart,
    DEFAULT_DAY_CONFIG.breakStart
  );
  const breakEnd = normalizeTimeSlot(
    config?.breakEnd,
    DEFAULT_DAY_CONFIG.breakEnd
  );
  let breakStartIndex = getSlotIndex(breakStart);
  let breakEndIndex = getSlotIndex(breakEnd);

  if (!breakEnabled) {
    return {
      enabled,
      start: ALL_TIME_SLOTS[startIndex],
      end: ALL_TIME_SLOTS[endIndex],
      breakEnabled: false,
      breakStart: DEFAULT_DAY_CONFIG.breakStart,
      breakEnd: DEFAULT_DAY_CONFIG.breakEnd,
    };
  }

  if (breakStartIndex < startIndex) {
    breakStartIndex = startIndex;
  }
  if (breakEndIndex > endIndex) {
    breakEndIndex = endIndex;
  }
  if (breakEndIndex <= breakStartIndex) {
    breakEnabled = false;
  }

  return {
    enabled,
    start: ALL_TIME_SLOTS[startIndex],
    end: ALL_TIME_SLOTS[endIndex],
    breakEnabled,
    breakStart: ALL_TIME_SLOTS[breakStartIndex] ?? DEFAULT_DAY_CONFIG.breakStart,
    breakEnd: ALL_TIME_SLOTS[breakEndIndex] ?? DEFAULT_DAY_CONFIG.breakEnd,
  };
};

const normalizeWorkingHoursConfig = (
  workingHoursRaw: unknown,
  workingDaysRaw?: number[]
): WorkingHoursConfig => {
  const enabledDays = Array.isArray(workingDaysRaw)
    ? workingDaysRaw
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [1, 2, 3, 4, 5, 6];
  const enabledSet = new Set(enabledDays);

  if (workingHoursRaw && typeof workingHoursRaw === 'object') {
    const rawConfig = workingHoursRaw as { days?: Record<string, any> };
    if (rawConfig.days && typeof rawConfig.days === 'object') {
      const days: Record<number, WorkingDayConfig> = {};
      for (let day = 0; day <= 6; day += 1) {
        const rawDay = rawConfig.days[String(day)] ?? rawConfig.days[day];
        days[day] = normalizeDayConfig(rawDay, enabledSet.has(day));
      }
      return { days };
    }
  }

  if (Array.isArray(workingHoursRaw)) {
    const validSlots = workingHoursRaw.filter(
      (slot): slot is string =>
        typeof slot === 'string' && ALL_TIME_SLOTS_SET.has(slot)
    );
    const uniqueSlots = Array.from(new Set(validSlots)).sort();
    let start = DEFAULT_DAY_CONFIG.start;
    let end = DEFAULT_DAY_CONFIG.end;
    if (uniqueSlots.length > 0) {
      start = uniqueSlots[0];
      const lastSlotIndex = getSlotIndex(uniqueSlots[uniqueSlots.length - 1]);
      const endIndex = Math.min(lastSlotIndex + 1, ALL_TIME_SLOTS.length - 1);
      end = ALL_TIME_SLOTS[endIndex];
    }

    const days: Record<number, WorkingDayConfig> = {};
    for (let day = 0; day <= 6; day += 1) {
      days[day] = normalizeDayConfig(
        {
          enabled: enabledSet.has(day),
          start,
          end,
          breakEnabled: false,
        },
        enabledSet.has(day)
      );
    }
    return { days };
  }

  return createWorkingHoursConfig(enabledDays);
};

interface IntegrationSettings {
  leadTimeMinutes: number;
  bufferMinutes: number;
  travelMinutes: number;
  defaultDurationHours: number;
  workingDays?: number[];
  workingHours?: WorkingHoursConfig | string[];
  googleCalendarStatus: string;
  googleCalendarEmail: string;
  googleCalendarEnabled?: boolean;
  googleSheetsStatus?: string;
  asaasStatus?: string;
  whatsappRemindersEnabled?: boolean;
  whatsappReminderHours?: number;
  whatsappMessageTemplate?: string;
  calculationsEnabled?: boolean;
  calculationsPerTicket?: boolean;
  calculationsClientTypes?: string[];
  stripePublicKey?: string;
  stripeSecretKey?: string;
  googleSheetsStatus?: string;
  asaasStatus?: string;
  whatsappRemindersEnabled?: boolean;
  whatsappReminderHours?: number;
  whatsappMessageTemplate?: string;
  calculationsEnabled?: boolean;
  calculationsPerTicket?: boolean;
  calculationsClientTypes?: string[];
}

export default function Configuracoes() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<IntegrationSettings>({
    queryKey: ['/api/integration-settings'],
  });

  const [preferences, setPreferences] = useState({
    leadTimeHours: 24,
    bufferMinutes: 15,
    travelMinutes: 30,
    defaultDurationMinutes: 60,
  });

  const [scheduleSettings, setScheduleSettings] = useState({
    workingHours: createWorkingHoursConfig([1, 2, 3, 4, 5, 6]),
  });


  const [calculationSettings, setCalculationSettings] = useState({
    enabled: true,
    perTicket: false,
    clientTypes: ['PF', 'PJ', 'EMPRESA_PARCEIRA'],
  });

  useEffect(() => {
    if (settings) {
      setPreferences({
        leadTimeHours: Math.round((Number(settings.leadTimeMinutes) || 0) / 60) || 24,
        bufferMinutes: Number(settings.bufferMinutes) || 15,
        travelMinutes: Number(settings.travelMinutes) || 30,
        defaultDurationMinutes: (Number(settings.defaultDurationHours) || 1) * 60,
      });

      const normalizedWorkingHours = normalizeWorkingHoursConfig(
        settings.workingHours,
        settings.workingDays
      );

      setScheduleSettings({
        workingHours: normalizedWorkingHours,
      });


      setCalculationSettings({
        enabled: settings.calculationsEnabled ?? true,
        perTicket: settings.calculationsPerTicket ?? false,
        clientTypes: settings.calculationsClientTypes || [
          'PF',
          'PJ',
          'EMPRESA_PARCEIRA',
        ],
      });

    }
  }, [settings]);


  const savePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', '/api/integration-settings', {
        leadTimeMinutes: data.leadTimeHours * 60, // Converter horas para minutos
        bufferMinutes: data.bufferMinutes,
        travelMinutes: data.travelMinutes,
        defaultDurationHours: data.defaultDurationMinutes / 60, // Converter minutos para horas
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/integration-settings'],
      });
      toast({
        title: 'Preferências salvas',
        description: 'As preferências de agendamento foram atualizadas.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    },
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', '/api/integration-settings', {
        workingDays: data.workingDays,
        workingHours: data.workingHours,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/integration-settings'],
      });
      toast({
        title: 'Horários salvos',
        description: 'Os dias de atendimento foram atualizados.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    },
  });


  const saveCalculationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PATCH', '/api/integration-settings', {
        calculationsEnabled: data.enabled,
        calculationsPerTicket: data.perTicket,
        calculationsClientTypes: data.clientTypes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/integration-settings'],
      });
      toast({
        title: 'Configurações de Chamados salvas',
        description: 'As preferências de faturamento foram atualizadas.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    },
  });

  const handleSavePreferences = () => {
    savePreferencesMutation.mutate(preferences);
  };

  const handleSaveSchedule = () => {
    const enabledDays = Object.entries(scheduleSettings.workingHours.days)
      .filter(([, config]) => config.enabled)
      .map(([day]) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .sort();
    saveScheduleMutation.mutate({
      workingDays: enabledDays,
      workingHours: scheduleSettings.workingHours,
    });
  };

  const updateDayConfig = (
    dayValue: number,
    updates: Partial<WorkingDayConfig>
  ) => {
    setScheduleSettings((prev) => {
      const current = prev.workingHours.days[dayValue] ?? DEFAULT_DAY_CONFIG;
      const nextEnabled = updates.enabled ?? current.enabled;
      const normalized = normalizeDayConfig(
        { ...current, ...updates, enabled: nextEnabled },
        nextEnabled
      );
      return {
        ...prev,
        workingHours: {
          days: {
            ...prev.workingHours.days,
            [dayValue]: normalized,
          },
        },
      };
    });
  };

  const applyPreset = (
    enabledDays: number[],
    overrides: Partial<WorkingDayConfig>
  ) => {
    setScheduleSettings((prev) => {
      const days = { ...prev.workingHours.days };
      for (let day = 0; day <= 6; day += 1) {
        const shouldEnable = enabledDays.includes(day);
        const current = days[day] ?? DEFAULT_DAY_CONFIG;
        days[day] = normalizeDayConfig(
          { ...current, ...overrides, enabled: shouldEnable },
          shouldEnable
        );
      }
      return {
        ...prev,
        workingHours: { days },
      };
    });
  };

  const applyWeekdaysPreset = () => {
    applyPreset([1, 2, 3, 4, 5], {
      start: '09:00',
      end: '18:00',
      breakEnabled: false,
      breakStart: DEFAULT_BREAK_START,
      breakEnd: DEFAULT_BREAK_END,
    });
  };

  const applyEverydayPreset = () => {
    applyPreset([0, 1, 2, 3, 4, 5, 6], {
      start: '09:00',
      end: '18:00',
      breakEnabled: false,
      breakStart: DEFAULT_BREAK_START,
      breakEnd: DEFAULT_BREAK_END,
    });
  };

  const clearSchedule = () => {
    applyPreset([], {});
  };


  const handleSaveCalculations = () => {
    saveCalculationMutation.mutate(calculationSettings);
  };

  const weekDays = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terca' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sabado' },
  ];
  const hasEnabledDay = Object.values(scheduleSettings.workingHours.days).some(
    (day) => day.enabled
  );

  return (
    <div className='space-y-6 p-6'>
      <PageHeader>
        <div className='px-6'>
          <div>
            <h1 className='text-3xl font-bold'>Configurações</h1>
          </div>
        </div>
      </PageHeader>

      <Tabs defaultValue="agendamento" className="max-w-4xl">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="agendamento" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="chamados" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Chamados
          </TabsTrigger>
        </TabsList>


        <TabsContent value="agendamento" className="space-y-6">
          {/* Preferências de Agendamento */}
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Agendamento</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {isLoading ? (
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className='space-y-1'>
                      <Skeleton className='h-4 w-32' />
                      <Skeleton className='h-9 w-full' />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    <div className='space-y-1'>
                      <Label htmlFor='lead-time'>Antecedência mín. (h)</Label>
                      <Input
                        id='lead-time'
                        type='number'
                        min='0'
                        max='168'
                        value={preferences.leadTimeHours}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            leadTimeHours: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className='space-y-1'>
                      <Label htmlFor='buffer-time'>Intervalo (min)</Label>
                      <Input
                        id='buffer-time'
                        type='number'
                        min='0'
                        max='120'
                        value={preferences.bufferMinutes}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            bufferMinutes: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className='space-y-1'>
                      <Label htmlFor='travel-time'>Deslocamento (min)</Label>
                      <Input
                        id='travel-time'
                        type='number'
                        min='0'
                        max='240'
                        value={preferences.travelMinutes}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            travelMinutes: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className='space-y-1'>
                      <Label htmlFor='default-duration'>
                        Duração padrão (min)
                      </Label>
                      <Input
                        id='default-duration'
                        type='number'
                        min='15'
                        max='480'
                        step='15'
                        value={preferences.defaultDurationMinutes}
                        onChange={(e) =>
                          setPreferences({
                            ...preferences,
                            defaultDurationMinutes:
                              parseInt(e.target.value) || 60,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className='flex justify-end pt-1'>
                    <Button
                      onClick={handleSavePreferences}
                      disabled={savePreferencesMutation.isPending}
                    >
                      {savePreferencesMutation.isPending ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Preferências'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Horario de Trabalho</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {isLoading ? (
                <div className='space-y-4'>
                  <Skeleton className='h-20 w-full' />
                  <Skeleton className='h-10 w-48' />
                </div>
              ) : (
                <>
                  <div className='space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <Label>Horarios de atendimento</Label>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={applyWeekdaysPreset}
                        >
                          Seg-Sex 09:00-18:00
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={applyEverydayPreset}
                        >
                          // Todos 09:00-18:00
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='ghost'
                          onClick={clearSchedule}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>

                    <div className='space-y-3'>
                      {weekDays.map((day) => {
                        const dayConfig =
                          scheduleSettings.workingHours.days[day.value] ??
                          DEFAULT_DAY_CONFIG;
                        const startIndex = getSlotIndex(dayConfig.start);
                        const endIndex = getSlotIndex(dayConfig.end);
                        const safeStartIndex = startIndex >= 0 ? startIndex : 0;
                        const safeEndIndex =
                          endIndex > safeStartIndex
                            ? endIndex
                            : safeStartIndex + 1;
                        const breakStartIndex = getSlotIndex(dayConfig.breakStart);
                        const safeBreakStartIndex =
                          breakStartIndex >= safeStartIndex
                            ? breakStartIndex
                            : safeStartIndex;
                        const endOptions = ALL_TIME_SLOTS.slice(
                          safeStartIndex + 1
                        );
                        const breakStartOptions = ALL_TIME_SLOTS.slice(
                          safeStartIndex,
                          safeEndIndex
                        );
                        const breakEndOptions = ALL_TIME_SLOTS.slice(
                          safeBreakStartIndex + 1,
                          safeEndIndex + 1
                        );

                        return (
                          <div
                            key={day.value}
                            className='grid gap-3 rounded-lg border p-3 md:grid-cols-[160px_1fr]'
                          >
                            <div className='flex items-center gap-2'>
                              <Switch
                                checked={dayConfig.enabled}
                                onCheckedChange={(checked) =>
                                  updateDayConfig(day.value, { enabled: checked })
                                }
                              />
                              <span className='text-sm font-medium'>
                                {day.label}
                              </span>
                            </div>

                            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                              <div className='grid flex-1 grid-cols-2 gap-2 md:max-w-[260px]'>
                                <div className='space-y-1'>
                                  <Label className='text-xs text-muted-foreground'>
                                    Abre
                                  </Label>
                                  <Select
                                    value={dayConfig.start}
                                    onValueChange={(value) =>
                                      updateDayConfig(day.value, { start: value })
                                    }
                                    disabled={!dayConfig.enabled}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ALL_TIME_SLOTS.map((slot) => (
                                        <SelectItem key={slot} value={slot}>
                                          {slot}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className='space-y-1'>
                                  <Label className='text-xs text-muted-foreground'>
                                    Fecha
                                  </Label>
                                  <Select
                                    value={dayConfig.end}
                                    onValueChange={(value) =>
                                      updateDayConfig(day.value, { end: value })
                                    }
                                    disabled={!dayConfig.enabled}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {endOptions.map((slot) => (
                                        <SelectItem key={slot} value={slot}>
                                          {slot}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className='flex flex-col gap-2 md:flex-row md:items-center'>
                                <div className='flex items-center gap-2'>
                                  <Switch
                                    checked={dayConfig.breakEnabled}
                                    onCheckedChange={(checked) =>
                                      updateDayConfig(day.value, {
                                        breakEnabled: checked,
                                      })
                                    }
                                    disabled={!dayConfig.enabled}
                                  />
                                  <span className='text-xs text-muted-foreground'>
                                    Pausa almoco
                                  </span>
                                </div>

                                {dayConfig.breakEnabled && (
                                  <div className='grid grid-cols-2 gap-2 md:max-w-[260px]'>
                                    <div className='space-y-1'>
                                      <Label className='text-xs text-muted-foreground'>
                                        Inicio
                                      </Label>
                                      <Select
                                        value={dayConfig.breakStart}
                                        onValueChange={(value) =>
                                          updateDayConfig(day.value, {
                                            breakStart: value,
                                          })
                                        }
                                        disabled={!dayConfig.enabled}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {breakStartOptions.map((slot) => (
                                            <SelectItem key={slot} value={slot}>
                                              {slot}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className='space-y-1'>
                                      <Label className='text-xs text-muted-foreground'>
                                        Fim
                                      </Label>
                                      <Select
                                        value={dayConfig.breakEnd}
                                        onValueChange={(value) =>
                                          updateDayConfig(day.value, {
                                            breakEnd: value,
                                          })
                                        }
                                        disabled={!dayConfig.enabled}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {breakEndOptions.map((slot) => (
                                            <SelectItem key={slot} value={slot}>
                                              {slot}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className='text-xs text-muted-foreground'>
                      Defina abertura, fechamento e pausa para cada dia de atendimento.
                    </p>
                  </div>

                  <div className='flex justify-end pt-2'>
                    <Button
                      onClick={handleSaveSchedule}
                      disabled={
                        !hasEnabledDay ||
                        saveScheduleMutation.isPending
                      }
                    >
                      {saveScheduleMutation.isPending ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Horarios'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chamados" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Chamados</CardTitle>
            </CardHeader>
            <CardContent className='space-y-6'>
              {isLoading ? (
                <div className='space-y-4'>
                  <Skeleton className='h-20 w-full' />
                  <Skeleton className='h-20 w-full' />
                  <Skeleton className='h-32 w-full' />
                </div>
              ) : (
                <>
                  {/* Opção 1: Master Switch */}
                  <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold">Habilitar Cálculos e Faturamento</Label>
                      <p className="text-sm text-muted-foreground">
                        Habilita globalmente o sistema de cronômetro, KM e cálculos de valores.
                      </p>
                    </div>
                    <Switch
                      checked={calculationSettings.enabled}
                      onCheckedChange={(checked) =>
                        setCalculationSettings({
                          ...calculationSettings,
                          enabled: checked,
                        })
                      }
                    />
                  </div>

                  {/* Opção 2: Per Ticket Toggle */}
                  <div className={cn(
                    "flex items-center justify-between p-4 border rounded-xl bg-card transition-opacity",
                    !calculationSettings.enabled && "opacity-50 pointer-events-none"
                  )}>
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold">Decidir ao Criar Chamado</Label>
                      <p className="text-sm text-muted-foreground">
                        Exibe uma opção no cadastro do chamado para ativar/desativar cálculos individualmente.
                      </p>
                    </div>
                    <Switch
                      checked={calculationSettings.perTicket}
                      onCheckedChange={(checked) =>
                        setCalculationSettings({
                          ...calculationSettings,
                          perTicket: checked,
                        })
                      }
                      disabled={!calculationSettings.enabled}
                    />
                  </div>

                  {/* Opção 3: By Client Type */}
                  <div className={cn(
                    "p-4 border rounded-xl bg-card space-y-4 transition-opacity",
                    !calculationSettings.enabled && "opacity-50 pointer-events-none"
                  )}>
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold">Habilitar por Tipo de Cliente</Label>
                      <p className="text-sm text-muted-foreground">
                        Selecione quais tipos de clientes devem ter o sistema de faturamento ativado.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      {['PF', 'PJ', 'EMPRESA_PARCEIRA'].map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={calculationSettings.clientTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              const newTypes = checked
                                ? [...calculationSettings.clientTypes, type]
                                : calculationSettings.clientTypes.filter((t) => t !== type);
                              setCalculationSettings({
                                ...calculationSettings,
                                clientTypes: newTypes,
                              });
                            }}
                            disabled={!calculationSettings.enabled}
                          />
                          <Label htmlFor={`type-${type}`} className="text-sm font-medium cursor-pointer">
                            {type === 'EMPRESA_PARCEIRA' ? 'Empresa Parceira' : type}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='flex justify-end pt-2'>
                    <Button
                      onClick={handleSaveCalculations}
                      disabled={saveCalculationMutation.isPending}
                    >
                      {saveCalculationMutation.isPending ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Configurações'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
}
