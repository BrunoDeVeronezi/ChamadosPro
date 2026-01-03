import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { Save } from 'lucide-react';

interface EmailReminderSettings {
  enabled: boolean;
  reminderBeforeTicket: number; // horas antes do chamado
  reminderAfterTicket: number; // horas após o chamado
  reminderForOverdue: boolean;
  reminderForPayment: boolean;
  reminderForNewClient: boolean;
}

export default function ConfiguracaoLembretesEmail() {
  const { toast } = useToast();
  const { isPaid } = usePaidAccess();
  if (!isPaid) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center p-6'>
        <Card className='w-full max-w-xl p-6 space-y-4'>
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>
              Lembretes por email estao disponiveis apenas na versao paga
            </h2>
            <p className='text-sm text-muted-foreground'>
              Assine um plano para liberar as automacoes de lembretes.
            </p>
          </div>
          <Button onClick={() => window.location.assign('/planos')}>
            Ver planos
          </Button>
        </Card>
      </div>
    );
  }
  const [settings, setSettings] = useState<EmailReminderSettings>({
    enabled: true,
    reminderBeforeTicket: 24,
    reminderAfterTicket: 48,
    reminderForOverdue: true,
    reminderForPayment: true,
    reminderForNewClient: false,
  });

  const { data: currentSettings } = useQuery<EmailReminderSettings>({
    queryKey: ['/api/settings/email-reminders'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/settings/email-reminders',
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar configurações');
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: EmailReminderSettings) => {
      const response = await apiRequest(
        'PUT',
        '/api/settings/email-reminders',
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
        queryKey: ['/api/settings/email-reminders'],
      });
      toast({
        title: 'Configurações salvas',
        description:
          'As configurações de lembretes por email foram salvas com sucesso.',
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

  if (
    currentSettings &&
    JSON.stringify(currentSettings) !== JSON.stringify(settings)
  ) {
    setSettings(currentSettings);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(settings);
  };

  return (
    <div className='relative flex min-h-screen w-full bg-[#f5f7f8] dark:bg-[#101722] font-display text-[#111418] dark:text-gray-200'>
      <main className='flex-1 p-8 overflow-y-auto'>
        <div className='max-w-4xl mx-auto'>
          <header className='mb-8'>
            <h1 className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
              Configuração de Lembretes por Email
            </h1>
            <p className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal mt-2'>
              Configure quando e como você recebe lembretes por email sobre
              atividades importantes.
            </p>
          </header>

          <form onSubmit={handleSubmit}>
            <Card className='bg-white dark:bg-[#101722]/50 rounded-xl shadow-sm p-8 space-y-8'>
              {/* Enable/Disable */}
              <div className='flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'>
                <div className='flex flex-col gap-1'>
                  <Label className='text-[#111418] dark:text-white text-base font-semibold'>
                    Habilitar Lembretes por Email
                  </Label>
                  <p className='text-[#60708a] dark:text-gray-400 text-sm'>
                    Ative para receber lembretes automáticos por email sobre
                    atividades importantes.
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enabled: checked })
                  }
                />
              </div>

              {settings.enabled && (
                <>
                  {/* Reminder Before Ticket */}
                  <div className='space-y-4'>
                    <Label className='text-[#111418] dark:text-white text-base font-semibold'>
                      Lembrete Antes do Chamado
                    </Label>
                    <div className='flex items-center gap-4'>
                      <Input
                        type='number'
                        min='0'
                        className='w-24'
                        value={settings.reminderBeforeTicket}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            reminderBeforeTicket: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <span className='text-[#60708a] dark:text-gray-400 text-sm'>
                        horas antes do chamado agendado
                      </span>
                    </div>
                  </div>

                  {/* Reminder After Ticket */}
                  <div className='space-y-4'>
                    <Label className='text-[#111418] dark:text-white text-base font-semibold'>
                      Lembrete Após o Chamado
                    </Label>
                    <div className='flex items-center gap-4'>
                      <Input
                        type='number'
                        min='0'
                        className='w-24'
                        value={settings.reminderAfterTicket}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            reminderAfterTicket: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                      <span className='text-[#60708a] dark:text-gray-400 text-sm'>
                        horas após a conclusão do chamado
                      </span>
                    </div>
                  </div>

                  {/* Specific Reminders */}
                  <div className='space-y-4'>
                    <Label className='text-[#111418] dark:text-white text-base font-semibold'>
                      Lembretes Específicos
                    </Label>
                    <div className='space-y-3'>
                      <div className='flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800'>
                        <div>
                          <Label className='text-[#111418] dark:text-white text-sm font-medium'>
                            Lembrete para Chamados Atrasados
                          </Label>
                          <p className='text-[#60708a] dark:text-gray-400 text-xs mt-1'>
                            Receba notificações quando um chamado estiver
                            atrasado
                          </p>
                        </div>
                        <Switch
                          checked={settings.reminderForOverdue}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              reminderForOverdue: checked,
                            })
                          }
                        />
                      </div>
                      <div className='flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800'>
                        <div>
                          <Label className='text-[#111418] dark:text-white text-sm font-medium'>
                            Lembrete para Pagamentos Pendentes
                          </Label>
                          <p className='text-[#60708a] dark:text-gray-400 text-xs mt-1'>
                            Receba notificações sobre pagamentos pendentes
                          </p>
                        </div>
                        <Switch
                          checked={settings.reminderForPayment}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              reminderForPayment: checked,
                            })
                          }
                        />
                      </div>
                      <div className='flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800'>
                        <div>
                          <Label className='text-[#111418] dark:text-white text-sm font-medium'>
                            Lembrete para Novos Clientes
                          </Label>
                          <p className='text-[#60708a] dark:text-gray-400 text-xs mt-1'>
                            Receba notificações quando um novo cliente for
                            cadastrado
                          </p>
                        </div>
                        <Switch
                          checked={settings.reminderForNewClient}
                          onCheckedChange={(checked) =>
                            setSettings({
                              ...settings,
                              reminderForNewClient: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className='flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-800'>
                <Button
                  type='submit'
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90'
                  disabled={saveMutation.isPending}
                >
                  <Save className='w-4 h-4 mr-2' />
                  {saveMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar Configurações'}
                </Button>
              </div>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
}
























