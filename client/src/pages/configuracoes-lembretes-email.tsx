import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { Loader2, Bold, Italic, List, CheckSquare } from 'lucide-react';
import { Link } from 'wouter';

interface EmailReminderConfig {
  enabled: boolean;
  timeValue: number;
  timeUnit: 'hours' | 'days' | 'weeks';
  timeDirection: 'before' | 'after';
  subject?: string;
  message: string;
}

interface EmailRemindersConfig {
  newTicketReminder: EmailReminderConfig;
  overduePaymentReminder: EmailReminderConfig;
  pendingTicketReminder: EmailReminderConfig;
}

const defaultConfig: EmailRemindersConfig = {
  newTicketReminder: {
    enabled: true,
    timeValue: 24,
    timeUnit: 'hours',
    timeDirection: 'before',
    message: `Olá {{cliente.nome}},

Este é um lembrete de que seu chamado de serviço está agendado para {{chamado.data}}.

Obrigado,
Equipe ChamadosPro`,
  },
  overduePaymentReminder: {
    enabled: false,
    timeValue: 1,
    timeUnit: 'days',
    timeDirection: 'after',
    message: `Olá {{cliente.nome}},

Este é um aviso de que sua cobrança está vencida.

Valor: {{cobranca.valor}}
Vencimento: {{cobranca.vencimento}}

Por favor, entre em contato para regularizar.

Obrigado,
Equipe ChamadosPro`,
  },
  pendingTicketReminder: {
    enabled: false,
    timeValue: 3,
    timeUnit: 'days',
    timeDirection: 'after',
    message: `Olá {{cliente.nome}},

Este é um lembrete de que você tem um chamado pendente.

Chamado: {{chamado.numero}}
Data: {{chamado.data}}

Por favor, entre em contato para agendar.

Obrigado,
Equipe ChamadosPro`,
  },
};

export default function ConfiguracoesLembretesEmail() {
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
  const [showVariables, setShowVariables] = useState<{
    [key: string]: boolean;
  }>({});

  const { data: config, isLoading } = useQuery<EmailRemindersConfig>({
    queryKey: ['/api/email-reminders-config'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/email-reminders-config', undefined);
        return response || defaultConfig;
      } catch {
        return defaultConfig;
      }
    },
  });

  const [remindersConfig, setRemindersConfig] =
    useState<EmailRemindersConfig>(defaultConfig);

  useEffect(() => {
    if (config) {
      setRemindersConfig(config);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (data: EmailRemindersConfig) => {
      return await apiRequest('PATCH', '/api/email-reminders-config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/email-reminders-config'],
      });
      toast({
        title: 'Configurações salvas',
        description: 'As configurações de lembretes foram atualizadas.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description:
          error.message || 'Não foi possível salvar as configurações.',
      });
    },
  });

  const handleSave = (reminderType: keyof EmailRemindersConfig) => {
    const updatedConfig = { ...remindersConfig };
    saveMutation.mutate(updatedConfig);
  };

  const updateReminderConfig = (
    reminderType: keyof EmailRemindersConfig,
    updates: Partial<EmailReminderConfig>
  ) => {
    setRemindersConfig((prev) => ({
      ...prev,
      [reminderType]: {
        ...prev[reminderType],
        ...updates,
      },
    }));
  };

  const availableVariables = {
    newTicketReminder: [
      { name: 'cliente.nome', description: 'Nome do cliente' },
      { name: 'chamado.data', description: 'Data do chamado' },
      { name: 'chamado.hora', description: 'Hora do chamado' },
      { name: 'chamado.servico', description: 'Nome do serviço' },
      { name: 'chamado.endereco', description: 'Endereço do atendimento' },
    ],
    overduePaymentReminder: [
      { name: 'cliente.nome', description: 'Nome do cliente' },
      { name: 'cobranca.valor', description: 'Valor da cobrança' },
      { name: 'cobranca.vencimento', description: 'Data de vencimento' },
      { name: 'cobranca.numero', description: 'Número da cobrança' },
    ],
    pendingTicketReminder: [
      { name: 'cliente.nome', description: 'Nome do cliente' },
      { name: 'chamado.numero', description: 'Número do chamado' },
      { name: 'chamado.data', description: 'Data do chamado' },
      { name: 'chamado.status', description: 'Status do chamado' },
    ],
  };

  const insertVariable = (
    reminderType: keyof EmailRemindersConfig,
    variable: string
  ) => {
    const currentMessage = remindersConfig[reminderType].message;
    const textarea = document.getElementById(
      `message-${reminderType}`
    ) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage =
        currentMessage.substring(0, start) +
        `{{${variable}}}` +
        currentMessage.substring(end);
      updateReminderConfig(reminderType, { message: newMessage });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + variable.length + 4,
          start + variable.length + 4
        );
      }, 0);
    }
  };

  const formatText = (
    reminderType: keyof EmailRemindersConfig,
    format: 'bold' | 'italic' | 'list'
  ) => {
    const textarea = document.getElementById(
      `message-${reminderType}`
    ) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const currentMessage = remindersConfig[reminderType].message;

    let newText = '';
    if (format === 'bold') {
      newText = `**${selectedText || 'texto'}**`;
    } else if (format === 'italic') {
      newText = `*${selectedText || 'texto'}*`;
    } else if (format === 'list') {
      newText = selectedText
        ? selectedText
            .split('\n')
            .map((line) => (line.trim() ? `- ${line.trim()}` : line))
            .join('\n')
        : '- ';
    }

    const newMessage =
      currentMessage.substring(0, start) +
      newText +
      currentMessage.substring(end);
    updateReminderConfig(reminderType, { message: newMessage });

    setTimeout(() => {
      textarea.focus();
      if (format === 'list' && !selectedText) {
        textarea.setSelectionRange(start + 2, start + 2);
      } else {
        textarea.setSelectionRange(
          start + newText.length,
          start + newText.length
        );
      }
    }, 0);
  };

  const renderReminderSection = (
    title: string,
    reminderType: keyof EmailRemindersConfig,
    description?: string
  ) => {
    const reminder = remindersConfig[reminderType];
    const isEnabled = reminder.enabled;

    return (
      <Card className='mb-6'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='text-xl font-semibold'>{title}</CardTitle>
              {description && (
                <p className='text-sm text-gray-500 mt-1'>{description}</p>
              )}
            </div>
            <div className='flex items-center gap-3'>
              <Label htmlFor={`toggle-${reminderType}`} className='text-sm'>
                Ativar este lembrete
              </Label>
              <Switch
                id={`toggle-${reminderType}`}
                checked={isEnabled}
                onCheckedChange={(checked) =>
                  updateReminderConfig(reminderType, { enabled: checked })
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isEnabled ? (
            <p className='text-sm text-gray-500'>
              Ative este lembrete para configurar as opções.
            </p>
          ) : (
            <div className='space-y-6'>
              {/* Quando Enviar */}
              <div>
                <Label className='text-sm font-medium mb-3 block'>
                  Quando Enviar?
                </Label>
                <div className='flex gap-3 items-center'>
                  <Input
                    type='number'
                    min='1'
                    value={reminder.timeValue}
                    onChange={(e) =>
                      updateReminderConfig(reminderType, {
                        timeValue: parseInt(e.target.value) || 1,
                      })
                    }
                    className='w-24'
                  />
                  <Select
                    value={reminder.timeUnit}
                    onValueChange={(value: 'hours' | 'days' | 'weeks') =>
                      updateReminderConfig(reminderType, { timeUnit: value })
                    }
                  >
                    <SelectTrigger className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='hours'>Horas</SelectItem>
                      <SelectItem value='days'>Dias</SelectItem>
                      <SelectItem value='weeks'>Semanas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={reminder.timeDirection}
                    onValueChange={(value: 'before' | 'after') =>
                      updateReminderConfig(reminderType, {
                        timeDirection: value,
                      })
                    }
                  >
                    <SelectTrigger className='w-40'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='before'>Antes do evento</SelectItem>
                      <SelectItem value='after'>Depois do evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conteúdo da Mensagem */}
              <div>
                <Label className='text-sm font-medium mb-3 block'>
                  Conteúdo da Mensagem
                </Label>
                <div className='border rounded-lg overflow-hidden'>
                  {/* Toolbar */}
                  <div className='flex items-center gap-2 p-2 border-b bg-gray-50'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => formatText(reminderType, 'bold')}
                      className='h-8 w-8 p-0'
                      title='Negrito'
                    >
                      <Bold className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => formatText(reminderType, 'italic')}
                      className='h-8 w-8 p-0'
                      title='Itálico'
                    >
                      <Italic className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => formatText(reminderType, 'list')}
                      className='h-8 w-8 p-0'
                      title='Lista'
                    >
                      <List className='h-4 w-4' />
                    </Button>
                    <div className='flex-1' />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() =>
                        setShowVariables((prev) => ({
                          ...prev,
                          [reminderType]: !prev[reminderType],
                        }))
                      }
                      className='h-8 text-xs'
                    >
                      <CheckSquare className='h-4 w-4 mr-1' />
                      Variáveis
                    </Button>
                  </div>

                  {/* Variables Panel */}
                  {showVariables[reminderType] && (
                    <div className='p-3 border-b bg-blue-50'>
                      <p className='text-xs font-medium mb-2'>
                        Variáveis Disponíveis:
                      </p>
                      <div className='flex flex-wrap gap-2'>
                        {availableVariables[reminderType].map((variable) => (
                          <Button
                            key={variable.name}
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() =>
                              insertVariable(reminderType, variable.name)
                            }
                            className='text-xs h-7'
                          >
                            {`{{${variable.name}}}`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Textarea */}
                  <Textarea
                    id={`message-${reminderType}`}
                    value={reminder.message}
                    onChange={(e) =>
                      updateReminderConfig(reminderType, {
                        message: e.target.value,
                      })
                    }
                    rows={8}
                    className='border-0 resize-none focus:ring-0'
                    placeholder='Digite o conteúdo da mensagem...'
                  />
                </div>
              </div>

              {/* Botão Salvar */}
              <div className='flex justify-end'>
                <Button
                  onClick={() => handleSave(reminderType)}
                  disabled={saveMutation.isPending}
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90'
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className='mx-auto max-w-4xl p-6'>
        <div className='animate-pulse space-y-4'>
          <div className='h-8 bg-gray-200 rounded w-1/3' />
          <div className='h-4 bg-gray-200 rounded w-2/3' />
          <div className='h-64 bg-gray-200 rounded' />
        </div>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-4xl p-6'>
      {/* Breadcrumb */}
      <div className='flex flex-wrap gap-2 mb-6'>
        <Link
          href='/'
          className='text-[#60708a] dark:text-gray-400 hover:text-primary dark:hover:text-primary text-base font-medium leading-normal'
        >
          Início
        </Link>
        <span className='text-[#60708a] dark:text-gray-500 text-base font-medium leading-normal'>
          /
        </span>
        <Link
          href='/configuracoes'
          className='text-[#60708a] dark:text-gray-400 hover:text-primary dark:hover:text-primary text-base font-medium leading-normal'
        >
          Configurações
        </Link>
        <span className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
          / Configuração de Lembretes por Email
        </span>
      </div>

      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-4xl font-black leading-tight tracking-[-0.033em] text-gray-900 dark:text-white mb-2'>
          Configuração de Lembretes por Email
        </h1>
        <p className='text-base text-gray-600 dark:text-gray-400'>
          Automatize a comunicação com seus clientes. Configure aqui os emails
          que serão enviados para cada tipo de evento.
        </p>
      </div>

      {/* Reminder Sections */}
      {renderReminderSection(
        'Lembrete de Novo Chamado Agendado',
        'newTicketReminder'
      )}
      {renderReminderSection(
        'Aviso de Cobrança Vencida',
        'overduePaymentReminder'
      )}
      {renderReminderSection(
        'Notificação de Chamado Pendente',
        'pendingTicketReminder'
      )}
    </div>
  );
}




















