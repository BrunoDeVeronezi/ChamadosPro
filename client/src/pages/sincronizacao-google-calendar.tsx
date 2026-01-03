import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import { Save, RefreshCw } from 'lucide-react';

interface GoogleCalendarSyncSettings {
  connected: boolean;
  email?: string;
  bidirectionalSync: boolean;
  chamadosproToGoogle: 'scheduled' | 'all';
  googleToChamadospro: 'all' | 'filtered';
  filterText?: string;
  conflictResolution: 'chamadospro' | 'google' | 'manual';
}

export default function SincronizacaoGoogleCalendar() {
  const { toast } = useToast();
  const { isPaid } = usePaidAccess();
  if (!isPaid) {
    return (
      <div className='min-h-[60vh] flex items-center justify-center p-6'>
        <Card className='w-full max-w-xl p-6 space-y-4'>
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>
              Integracao com Google Calendar esta disponivel apenas na versao paga
            </h2>
            <p className='text-sm text-muted-foreground'>
              Assine um plano para liberar a sincronizacao com o Google Calendar.
            </p>
          </div>
          <Button onClick={() => window.location.assign('/planos')}>
            Ver planos
          </Button>
        </Card>
      </div>
    );
  }
  const [settings, setSettings] = useState<GoogleCalendarSyncSettings>({
    connected: false,
    bidirectionalSync: true,
    chamadosproToGoogle: 'scheduled',
    googleToChamadospro: 'filtered',
    filterText: '#chamadospro',
    conflictResolution: 'chamadospro',
  });

  const { data: currentSettings } = useQuery<GoogleCalendarSyncSettings>({
    queryKey: ['/api/settings/google-calendar'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/settings/google-calendar',
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar configurações');
      return response.json();
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        'POST',
        '/api/settings/google-calendar/connect',
        {}
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao conectar Google Calendar');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['/api/settings/google-calendar'],
      });
      setSettings((prev) => ({ ...prev, connected: true, email: data.email }));
      toast({
        title: 'Google Calendar conectado',
        description:
          'A conexão com o Google Calendar foi estabelecida com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar',
        description: error.message,
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: GoogleCalendarSyncSettings) => {
      const response = await apiRequest(
        'PUT',
        '/api/settings/google-calendar',
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
        queryKey: ['/api/settings/google-calendar'],
      });
      toast({
        title: 'Configurações salvas',
        description:
          'As configurações de sincronização foram salvas com sucesso.',
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
    <div className='relative flex min-h-screen w-full bg-[#101722] font-display text-white/90'>
      <main className='flex-1 p-8 overflow-y-auto'>
        <div className='max-w-4xl mx-auto'>
          <div className='flex flex-wrap justify-between gap-4 mb-8'>
            <div className='flex flex-col gap-2'>
              <h1 className='text-white/90 text-3xl font-bold leading-tight tracking-tight'>
                Sincronização com Google Calendar
              </h1>
              <p className='text-white/60 text-base font-normal leading-normal'>
                Gerencie como os eventos são sincronizados entre o ChamadosPro e
                sua conta Google.
              </p>
            </div>
          </div>

          {/* Status da Conexão */}
          <Card className='mb-8 flex flex-col items-start justify-between gap-4 rounded-lg border border-white/10 bg-[#161f2c] p-5 md:flex-row md:items-center'>
            <div className='flex flex-col gap-1'>
              <p className='text-white/90 text-base font-bold leading-tight'>
                Status da Conexão
              </p>
              <div className='flex items-center gap-2'>
                {settings.connected ? (
                  <>
                    <span className='relative flex h-2 w-2'>
                      <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                      <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                    </span>
                    <p className='text-white/60 text-sm font-normal leading-normal'>
                      Conectado como {settings.email || 'tecnico@google.com'}
                    </p>
                  </>
                ) : (
                  <>
                    <span className='relative flex h-2 w-2'>
                      <span className='relative inline-flex rounded-full h-2 w-2 bg-gray-500'></span>
                    </span>
                    <p className='text-white/60 text-sm font-normal leading-normal'>
                      Não conectado
                    </p>
                  </>
                )}
              </div>
            </div>
            <Button
              className='bg-[#3880f5] hover:bg-[#3880f5]/90'
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              <RefreshCw className='w-4 h-4 mr-2' />
              {settings.connected
                ? 'Reconectar / Alterar Conta'
                : 'Conectar Google Calendar'}
            </Button>
          </Card>

          {settings.connected && (
            <form onSubmit={handleSubmit} className='space-y-8'>
              {/* Sincronização Bidirecional */}
              <Card className='bg-[#101722] border border-white/10 rounded-lg'>
                <div className='flex items-center gap-4 px-5 py-4 min-h-14 justify-between'>
                  <div className='flex items-center gap-4'>
                    <div className='text-[#3880f5] flex items-center justify-center rounded-lg bg-[#3880f5]/20 shrink-0 size-10'>
                      <RefreshCw className='w-5 h-5' />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-white/90 text-base font-medium leading-normal flex-1 truncate'>
                        Ativar Sincronização Bidirecional
                      </Label>
                      <p className='text-white/60 text-sm'>
                        Permite a troca de eventos entre as plataformas.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.bidirectionalSync}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, bidirectionalSync: checked })
                    }
                  />
                </div>
              </Card>

              {/* ChamadosPro → Google Calendar */}
              <Card className='bg-[#101722] border border-white/10 rounded-lg'>
                <h2 className='text-white/90 text-lg font-bold leading-tight px-5 pb-3 pt-5 border-b border-white/10'>
                  Sincronização ChamadosPro → Google Calendar
                </h2>
                <div className='p-5 space-y-4'>
                  <p className='text-sm text-white/60'>
                    Selecione quais eventos do ChamadosPro devem ser enviados
                    para sua agenda Google.
                  </p>
                  <RadioGroup
                    value={settings.chamadosproToGoogle}
                    onValueChange={(value: 'scheduled' | 'all') =>
                      setSettings({ ...settings, chamadosproToGoogle: value })
                    }
                    className='flex flex-col gap-3'
                  >
                    <div className='flex items-center gap-3'>
                      <RadioGroupItem
                        value='scheduled'
                        id='sync-scheduled'
                        className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                      />
                      <Label
                        htmlFor='sync-scheduled'
                        className='text-white/90 text-sm cursor-pointer'
                      >
                        Somente Chamados Agendados
                      </Label>
                    </div>
                    <div className='flex items-center gap-3'>
                      <RadioGroupItem
                        value='all'
                        id='sync-all'
                        className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                      />
                      <Label
                        htmlFor='sync-all'
                        className='text-white/90 text-sm cursor-pointer'
                      >
                        // Todos os Chamados (Agendados e Não Agendados)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </Card>

              {/* Google Calendar → ChamadosPro */}
              <Card className='bg-[#101722] border border-white/10 rounded-lg'>
                <h2 className='text-white/90 text-lg font-bold leading-tight px-5 pb-3 pt-5 border-b border-white/10'>
                  Sincronização Google Calendar → ChamadosPro
                </h2>
                <div className='p-5 space-y-4'>
                  <p className='text-sm text-white/60'>
                    Selecione quais eventos da sua agenda Google devem ser
                    importados para o ChamadosPro.
                  </p>
                  <RadioGroup
                    value={settings.googleToChamadospro}
                    onValueChange={(value: 'all' | 'filtered') =>
                      setSettings({ ...settings, googleToChamadospro: value })
                    }
                    className='flex flex-col gap-3'
                  >
                    <div className='flex items-center gap-3'>
                      <RadioGroupItem
                        value='all'
                        id='google-all'
                        className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                      />
                      <Label
                        htmlFor='google-all'
                        className='text-white/90 text-sm cursor-pointer'
                      >
                        // Todos os Eventos
                      </Label>
                    </div>
                    <div className='flex flex-col gap-2'>
                      <div className='flex items-center gap-3'>
                        <RadioGroupItem
                          value='filtered'
                          id='google-filtered'
                          className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                        />
                        <Label
                          htmlFor='google-filtered'
                          className='text-white/90 text-sm cursor-pointer'
                        >
                          Apenas eventos com o texto específico:
                        </Label>
                      </div>
                      <Input
                        className='w-full max-w-xs ml-7 rounded-md border-white/20 shadow-sm focus:border-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent text-white/90 text-sm'
                        placeholder='ex: #chamadospro'
                        value={settings.filterText}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            filterText: e.target.value,
                          })
                        }
                      />
                    </div>
                  </RadioGroup>
                </div>
              </Card>

              {/* Resolução de Conflitos */}
              <Card className='bg-[#101722] border border-white/10 rounded-lg'>
                <h2 className='text-white/90 text-lg font-bold leading-tight px-5 pb-3 pt-5 border-b border-white/10'>
                  Resolução de Conflitos
                </h2>
                <div className='p-5 space-y-4'>
                  <p className='text-sm text-white/60'>
                    Quando um evento for alterado nos dois lugares ao mesmo
                    tempo:
                  </p>
                  <RadioGroup
                    value={settings.conflictResolution}
                    onValueChange={(
                      value: 'chamadospro' | 'google' | 'manual'
                    ) =>
                      setSettings({ ...settings, conflictResolution: value })
                    }
                    className='flex flex-col gap-3'
                  >
                    <div className='flex items-center gap-3'>
                      <RadioGroupItem
                        value='chamadospro'
                        id='conflict-chamadospro'
                        className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                      />
                      <Label
                        htmlFor='conflict-chamadospro'
                        className='text-white/90 text-sm cursor-pointer'
                      >
                        Manter a versão do ChamadosPro (Recomendado)
                      </Label>
                    </div>
                    <div className='flex items-center gap-3'>
                      <RadioGroupItem
                        value='google'
                        id='conflict-google'
                        className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                      />
                      <Label
                        htmlFor='conflict-google'
                        className='text-white/90 text-sm cursor-pointer'
                      >
                        Manter a versão do Google Calendar
                      </Label>
                    </div>
                    <div className='flex items-center gap-3'>
                      <RadioGroupItem
                        value='manual'
                        id='conflict-manual'
                        className='text-[#3880f5] focus:ring-[#3880f5]/50 bg-transparent border-white/30'
                      />
                      <Label
                        htmlFor='conflict-manual'
                        className='text-white/90 text-sm cursor-pointer'
                      >
                        Notificar para resolução manual
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </Card>

              <div className='flex justify-end gap-3 pt-4'>
                <Button
                  type='button'
                  variant='outline'
                  className='bg-white/10 text-white/90 hover:bg-white/20'
                  onClick={() => window.history.back()}
                >
                  Cancelar
                </Button>
                <Button
                  type='submit'
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90'
                  disabled={saveMutation.isPending}
                >
                  <Save className='w-4 h-4 mr-2' />
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}























