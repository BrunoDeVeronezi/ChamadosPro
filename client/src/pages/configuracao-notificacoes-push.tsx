import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Save, X } from 'lucide-react';

interface PushNotificationSettings {
  enabled: boolean;
  // Tipos de eventos
  newTicketCreated: boolean;
  ticketCancelled: boolean;
  ticketStartedCompleted: boolean;
  schedulingReminder: boolean;
  newPendingCharge: boolean;
  overdueCharge: boolean;
  // Agrupamento
  grouping: 'immediate' | 'daily' | 'weekly';
  dailySummaryTime?: string; // HH:mm format
  weeklySummaryDay?: string; // day of week
  weeklySummaryTime?: string; // HH:mm format
}

export default function ConfiguracaoNotificacoesPush() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PushNotificationSettings>({
    enabled: true,
    newTicketCreated: true,
    ticketCancelled: false,
    ticketStartedCompleted: true,
    schedulingReminder: true,
    newPendingCharge: false,
    overdueCharge: false,
    grouping: 'immediate',
    dailySummaryTime: '09:00',
    weeklySummaryDay: 'monday',
    weeklySummaryTime: '09:00',
  });

  const { data: currentSettings, isLoading } =
    useQuery<PushNotificationSettings>({
      queryKey: ['/api/settings/push-notifications'],
      queryFn: async () => {
        const response = await apiRequest(
          'GET',
          '/api/settings/push-notifications',
          undefined
        );
        if (!response.ok) {
          // Se não existir, retorna configurações padrão
          return settings;
        }
        return response.json();
      },
    });

  useEffect(() => {
    if (currentSettings) {
      setSettings((prev) => ({
        ...prev,
        ...currentSettings,
      }));
    }
  }, [currentSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data: PushNotificationSettings) => {
      const response = await apiRequest(
        'PUT',
        '/api/settings/push-notifications',
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar configurações');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/settings/push-notifications'],
      });
      toast({
        title: 'Configurações salvas',
        description:
          'As configurações de notificações push foram salvas com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar configurações',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <p className='text-muted-foreground'>Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6 p-6'>
      <div>
        <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
          Configuração de Notificações Push
        </h1>
        <p className='text-muted-foreground mt-1'>
          Gerencie como e quando você recebe notificações no seu desktop.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className='border border-gray-200 dark:border-gray-700 shadow-md'>
          <CardContent className='p-6 space-y-6'>
            {/* Habilitar Notificações Push no Desktop */}
            <div className='flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-sm'>
              <div className='space-y-0.5'>
                <Label
                  htmlFor='enable-push'
                  className='text-base font-semibold'
                >
                  Habilitar Notificações Push no Desktop
                </Label>
                <p className='text-sm text-muted-foreground'>
                  Ative para receber alertas sobre atividades importantes.
                </p>
              </div>
              <Switch
                id='enable-push'
                checked={settings.enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enabled: checked })
                }
              />
            </div>

            {settings.enabled && (
              <>
                {/* Receber notificações para */}
                <div className='space-y-4'>
                  <Label className='text-base font-semibold'>
                    Receber notificações para:
                  </Label>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {/* Novo Chamado Criado */}
                    <div className='flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <Checkbox
                        id='new-ticket-created'
                        checked={settings.newTicketCreated}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            newTicketCreated: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor='new-ticket-created'
                        className='text-sm font-medium cursor-pointer flex-1'
                      >
                        // Novo Chamado Criado
                      </Label>
                    </div>

                    {/* Chamado Iniciado/Concluído */}
                    <div className='flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <Checkbox
                        id='ticket-started-completed'
                        checked={settings.ticketStartedCompleted}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            ticketStartedCompleted: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor='ticket-started-completed'
                        className='text-sm font-medium cursor-pointer flex-1'
                      >
                        Chamado Iniciado/Concluído
                      </Label>
                    </div>

                    {/* Chamado Cancelado */}
                    <div className='flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <Checkbox
                        id='ticket-cancelled'
                        checked={settings.ticketCancelled}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            ticketCancelled: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor='ticket-cancelled'
                        className='text-sm font-medium cursor-pointer flex-1'
                      >
                        Chamado Cancelado
                      </Label>
                    </div>

                    {/* Lembrete de Agendamento */}
                    <div className='flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <Checkbox
                        id='scheduling-reminder'
                        checked={settings.schedulingReminder}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            schedulingReminder: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor='scheduling-reminder'
                        className='text-sm font-medium cursor-pointer flex-1'
                      >
                        Lembrete de Agendamento
                      </Label>
                    </div>

                    {/* Nova Cobrança Pendente */}
                    <div className='flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <Checkbox
                        id='new-pending-charge'
                        checked={settings.newPendingCharge}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            newPendingCharge: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor='new-pending-charge'
                        className='text-sm font-medium cursor-pointer flex-1'
                      >
                        Nova Cobrança Pendente
                      </Label>
                    </div>

                    {/* Cobrança Vencida */}
                    <div className='flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <Checkbox
                        id='overdue-charge'
                        checked={settings.overdueCharge}
                        onCheckedChange={(checked) =>
                          setSettings({
                            ...settings,
                            overdueCharge: checked as boolean,
                          })
                        }
                      />
                      <Label
                        htmlFor='overdue-charge'
                        className='text-sm font-medium cursor-pointer flex-1'
                      >
                        Cobrança Vencida
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Como agrupar as notificações */}
                <div className='space-y-4'>
                  <Label className='text-base font-semibold'>
                    Como agrupar as notificações:
                  </Label>
                  <RadioGroup
                    value={settings.grouping}
                    onValueChange={(value: 'immediate' | 'daily' | 'weekly') =>
                      setSettings({ ...settings, grouping: value })
                    }
                    className='space-y-3'
                  >
                    {/* Notificar Imediatamente */}
                    <div className='flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <RadioGroupItem
                        value='immediate'
                        id='grouping-immediate'
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='grouping-immediate'
                          className='text-sm font-medium cursor-pointer block mb-1'
                        >
                          Notificar Imediatamente
                        </Label>
                        <p className='text-xs text-muted-foreground'>
                          Receba uma notificação para cada evento assim que
                          acontecer.
                        </p>
                      </div>
                    </div>

                    {/* Enviar um Resumo Diário */}
                    <div className='flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <RadioGroupItem
                        value='daily'
                        id='grouping-daily'
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='grouping-daily'
                          className='text-sm font-medium cursor-pointer block mb-1'
                        >
                          Enviar um Resumo Diário
                        </Label>
                        <p className='text-xs text-muted-foreground'>
                          Receba um único resumo de todas as notificações do dia
                          às 09:00.
                        </p>
                      </div>
                    </div>

                    {/* Enviar um Resumo Semanal */}
                    <div className='flex items-start space-x-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'>
                      <RadioGroupItem
                        value='weekly'
                        id='grouping-weekly'
                        className='mt-1'
                      />
                      <div className='flex-1'>
                        <Label
                          htmlFor='grouping-weekly'
                          className='text-sm font-medium cursor-pointer block mb-1'
                        >
                          Enviar um Resumo Semanal
                        </Label>
                        <p className='text-xs text-muted-foreground'>
                          Receba um resumo semanal toda segunda-feira às 09:00.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </>
            )}

            {/* Botões de ação */}
            <div className='flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700'>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  // Resetar para valores padrão
                  setSettings({
                    enabled: true,
                    newTicketCreated: true,
                    ticketCancelled: false,
                    ticketStartedCompleted: true,
                    schedulingReminder: true,
                    newPendingCharge: false,
                    overdueCharge: false,
                    grouping: 'immediate',
                    dailySummaryTime: '09:00',
                    weeklySummaryDay: 'monday',
                    weeklySummaryTime: '09:00',
                  });
                }}
              >
                <X className='w-4 h-4 mr-2' />
                Cancelar
              </Button>
              <Button
                type='submit'
                className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
                disabled={saveMutation.isPending}
              >
                <Save className='w-4 h-4 mr-2' />
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}