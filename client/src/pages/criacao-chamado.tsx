import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  User,
  Hash,
  Wrench,
  MapPin,
  AlignLeft,
  Calendar,
  Clock,
  DollarSign,
  CreditCard,
  CheckCircle,
  Users,
  Save,
  X,
} from 'lucide-react';
import { maskCurrency } from '@/lib/masks';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

export default function CriacaoChamado() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientId: '',
    ticketNumber: `CH-${new Date().getFullYear()}${String(
      Math.floor(Math.random() * 100000)
    ).padStart(5, '0')}`,
    serviceId: '',
    address: '',
    description: '',
    scheduledFor: '',
    scheduledEndDate: '',
    ticketValue: '',
    chargeType: 'DIARIA' as 'DIARIA' | 'AVULSO',
    approvedBy: '',
    finalClient: '',
  });
  const [clientSearch, setClientSearch] = useState('');

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients', undefined);
      if (!response.ok) throw new Error('Erro ao carregar clientes');
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/tickets', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar chamado');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: 'Chamado criado',
        description: 'O chamado foi criado com sucesso.',
      });
      setLocation('/chamados');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar chamado',
        description: error.message,
      });
    },
  });

  const filteredClients = clients?.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className='flex min-h-screen bg-[#f5f7f8] dark:bg-[#101722]'>
      <main className='flex-1 p-8 overflow-y-auto'>
        <div className='max-w-4xl mx-auto'>
          <div className='flex flex-wrap justify-between gap-3 pb-6'>
            <div className='flex min-w-72 flex-col gap-2'>
              <h1 className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
                Criação de Chamado
              </h1>
              <p className='text-gray-600 dark:text-gray-400 text-base font-normal leading-normal'>
                Preencha os detalhes abaixo para registrar um novo chamado de
                serviço.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className='space-y-8'>
            {/* Informações Gerais */}
            <Card className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm overflow-hidden relative'>
              <div className='flex items-center gap-3 mb-6'>
                <div className='p-2 bg-primary/10 rounded-lg'>
                  <User className='h-5 w-5 text-primary' />
                </div>
                <h2 className='text-slate-900 dark:text-white text-xl font-black tracking-tight'>
                  Informações Gerais
                </h2>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col min-w-40 flex-1'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <User className='h-3.5 w-3.5 text-primary' />
                    Cliente*
                  </Label>
                  <div className='relative group'>
                    <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors w-5 h-5' />
                    <Input
                      className='pl-12 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-primary/50 rounded-xl'
                      placeholder='Buscar e selecionar cliente...'
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                    {clientSearch &&
                      filteredClients &&
                      filteredClients.length > 0 && (
                        <div className='absolute z-10 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2'>
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              type='button'
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  clientId: client.id,
                                });
                                setClientSearch(client.name);
                              }}
                              className='w-full text-left px-4 py-3 text-slate-700 dark:text-slate-200 hover:bg-primary/5 hover:text-primary transition-colors border-b border-slate-100 last:border-0 dark:border-slate-700'
                            >
                              <div className='font-bold'>{client.name}</div>
                              <div className='text-xs opacity-60'>{client.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
                <div className='flex flex-col min-w-40 flex-1'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <Hash className='h-3.5 w-3.5 text-primary' />
                    Número do Chamado
                  </Label>
                  <Input
                    className='h-12 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-mono font-bold rounded-xl'
                    value={formData.ticketNumber}
                    readOnly
                  />
                </div>
              </div>
              <div className='absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16' />
            </Card>

            {/* Detalhes do Serviço */}
            <Card className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm overflow-hidden relative'>
              <div className='flex items-center gap-3 mb-6'>
                <div className='p-2 bg-blue-500/10 rounded-lg'>
                  <Wrench className='h-5 w-5 text-blue-500' />
                </div>
                <h2 className='text-slate-900 dark:text-white text-xl font-black tracking-tight'>
                  Detalhes do Serviço
                </h2>
              </div>
              <div className='grid grid-cols-1 gap-6'>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <Wrench className='h-3.5 w-3.5 text-blue-500' />
                    Serviço*
                  </Label>
                  <Select
                    value={formData.serviceId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, serviceId: value })
                    }
                  >
                    <SelectTrigger className='h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl'>
                      <SelectValue placeholder='Selecione um serviço' />
                    </SelectTrigger>
                    <SelectContent className='bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl'>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id} className='rounded-lg m-1'>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <MapPin className='h-3.5 w-3.5 text-blue-500' />
                    Endereço
                  </Label>
                  <div className='relative'>
                    <MapPin className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4' />
                    <Input
                      className='pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl'
                      placeholder='Digite o endereço do serviço'
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <AlignLeft className='h-3.5 w-3.5 text-blue-500' />
                    Descrição do Chamado
                  </Label>
                  <div className='relative'>
                    <AlignLeft className='absolute left-4 top-4 text-slate-400 w-4 h-4' />
                    <Textarea
                      className='pl-10 min-h-32 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl resize-none'
                      placeholder='Descreva o problema ou a solicitação do cliente...'
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className='absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16' />
            </Card>

            {/* Agendamento */}
            <Card className='bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm overflow-hidden relative'>
              <div className='flex items-center gap-3 mb-6'>
                <div className='p-2 bg-amber-500/10 rounded-lg'>
                  <Calendar className='h-5 w-5 text-amber-500' />
                </div>
                <h2 className='text-slate-900 dark:text-white text-xl font-black tracking-tight'>
                  Agendamento
                </h2>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <Calendar className='h-3.5 w-3.5 text-amber-500' />
                    Início*
                  </Label>
                  <div className='relative'>
                    <Calendar className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none' />
                    <Input
                      type='datetime-local'
                      className='pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl'
                      value={formData.scheduledFor}
                      onChange={(e) =>
                        setFormData({ ...formData, scheduledFor: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <Clock className='h-3.5 w-3.5 text-amber-500' />
                    Fim (Estimado)
                  </Label>
                  <div className='relative'>
                    <Clock className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none' />
                    <Input
                      type='datetime-local'
                      className='pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl'
                      value={formData.scheduledEndDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          scheduledEndDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className='absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16' />
            </Card>

            {/* Detalhes para Empresa Parceira */}
            <Card className='bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/20 p-6 rounded-2xl shadow-sm overflow-hidden relative'>
              <div className='flex items-center gap-3 mb-6'>
                <div className='p-2 bg-primary/20 rounded-lg'>
                  <Users className='h-5 w-5 text-primary' />
                </div>
                <h2 className='text-slate-900 dark:text-white text-xl font-black tracking-tight'>
                  Detalhes para Empresa Parceira
                </h2>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <DollarSign className='h-3.5 w-3.5 text-primary' />
                    Valor (R$)
                  </Label>
                  <div className='relative'>
                    <span className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold'>R$</span>
                    <Input
                      className='pl-10 h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 font-black rounded-xl'
                      placeholder='0,00'
                      value={formData.ticketValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ticketValue: maskCurrency(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <CreditCard className='h-3.5 w-3.5 text-primary' />
                    Tipo de Cobrança
                  </Label>
                  <Select
                    value={formData.chargeType}
                    onValueChange={(value: 'DIARIA' | 'AVULSO') =>
                      setFormData({ ...formData, chargeType: value })
                    }
                  >
                    <SelectTrigger className='h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className='bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl'>
                      <SelectItem value='DIARIA' className='rounded-lg m-1'>Por Hora</SelectItem>
                      <SelectItem value='AVULSO' className='rounded-lg m-1'>Valor Fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <CheckCircle className='h-3.5 w-3.5 text-primary' />
                    Aprovado por
                  </Label>
                  <div className='relative'>
                    <User className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4' />
                    <Input
                      className='pl-10 h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl'
                      placeholder='Nome do aprovador'
                      value={formData.approvedBy}
                      onChange={(e) =>
                        setFormData({ ...formData, approvedBy: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className='flex flex-col'>
                  <Label className='flex items-center gap-2 text-slate-700 dark:text-slate-300 text-sm font-bold mb-2'>
                    <Users className='h-3.5 w-3.5 text-primary' />
                    Cliente Final
                  </Label>
                  <div className='relative'>
                    <Users className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4' />
                    <Input
                      className='pl-10 h-12 bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl'
                      placeholder='Nome ou código do cliente final'
                      value={formData.finalClient}
                      onChange={(e) =>
                        setFormData({ ...formData, finalClient: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className='absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full -ml-16 -mb-16' />
            </Card>

            <div className='flex justify-end items-center gap-4 pt-6'>
              <Button
                type='button'
                variant='ghost'
                className='h-12 px-8 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-all'
                onClick={() => setLocation('/chamados')}
              >
                <X className='h-4 w-4 mr-2' />
                Cancelar
              </Button>
              <Button
                type='submit'
                className='h-12 px-10 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98]'
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <div className='h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2' />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className='h-4 w-4 mr-2' />
                    Salvar Chamado
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
























