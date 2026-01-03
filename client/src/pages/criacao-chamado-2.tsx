import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';
import { maskCurrency } from '@/lib/masks';

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

export default function CriacaoChamado2() {
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
    chargeType: 'Por Hora' as 'Por Hora' | 'Valor Fixo',
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
    <div className='bg-background-light dark:bg-background-dark font-display text-gray-800 dark:text-gray-200'>
      <div className='relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden'>
        <div className='flex min-h-screen'>
          {/* SideNavBar Component */}
          <nav className='w-64 shrink-0 bg-white dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-800 flex flex-col'>
            <div className='flex flex-col gap-4 p-4'>
              <div className='flex gap-3 items-center'>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                <div className='flex flex-col'>
                  <h1 className='text-gray-900 dark:text-white text-base font-medium leading-normal'>
                    ChamadosPro
                  </h1>
                  <p className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal'>
                    Gestão de Serviços
                  </p>
                </div>
              </div>
              <div className='flex flex-col gap-2'>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Dashboard
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 dark:bg-primary/20'
                  href='#'
                >
                  <span className='text-primary text-sm font-medium leading-normal'>
                    Chamados
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Clientes
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Agenda
                  </span>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                  href='#'
                >
                  <span className='text-gray-800 dark:text-gray-200'>
                    Financeiro
                  </span>
                </a>
              </div>
            </div>
            <div className='mt-auto p-4'>
              <Button
                className='flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors'
                onClick={() => setLocation('/criacao-chamado')}
              >
                <span className='truncate'>Novo Chamado</span>
              </Button>
            </div>
          </nav>

          {/* Main Content Area */}
          <main className='flex-1 p-8 overflow-y-auto'>
            <div className='max-w-4xl mx-auto'>
              {/* PageHeading Component */}
              <div className='flex flex-wrap justify-between gap-3 pb-6'>
                <div className='flex min-w-72 flex-col gap-2'>
                  <h1 className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
                    Criação de Chamado
                  </h1>
                  <p className='text-gray-500 dark:text-gray-400 text-base font-normal leading-normal'>
                    Preencha os detalhes abaixo para registrar um novo chamado
                    de serviço.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className='space-y-8'>
                {/* Form Section 1: General Information */}
                <Card className='bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-800'>
                  <h2 className='text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                    Informações Gerais
                  </h2>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='flex flex-col min-w-40 flex-1'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Cliente*
                      </Label>
                      <div className='relative'>
                        <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5' />
                        <Input
                          className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 pl-12 pr-4 py-3 text-base font-normal leading-normal'
                          placeholder='Buscar e selecionar cliente...'
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                        />
                      </div>
                      {clientSearch &&
                        filteredClients &&
                        filteredClients.length > 0 && (
                          <div className='absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                            {filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type='button'
                                className='w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700'
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    clientId: client.id,
                                  });
                                  setClientSearch(client.name);
                                }}
                              >
                                {client.name}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    <div className='flex flex-col min-w-40 flex-1'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Número do Chamado
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
                        value={formData.ticketNumber}
                        readOnly
                      />
                    </div>
                  </div>
                </Card>

                {/* Form Section 2: Service Details */}
                <Card className='bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-800'>
                  <h2 className='text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                    Detalhes do Serviço
                  </h2>
                  <div className='grid grid-cols-1 gap-6'>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Serviço*
                      </Label>
                      <Select
                        value={formData.serviceId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, serviceId: value })
                        }
                      >
                        <SelectTrigger className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'>
                          <SelectValue placeholder='Selecione um serviço' />
                        </SelectTrigger>
                        <SelectContent>
                          {services?.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Endereço
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
                        placeholder='Digite o endereço do serviço'
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Descrição do Chamado
                      </Label>
                      <Textarea
                        className='flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 min-h-32 placeholder:text-gray-500 dark:placeholder:text-gray-400 p-4 text-base font-normal leading-normal'
                        placeholder='Descreva o problema ou a solicitação do cliente...'
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </Card>

                {/* Form Section 3: Scheduling */}
                <Card className='bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-800'>
                  <h2 className='text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                    Agendamento
                  </h2>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Data e Hora de Início*
                      </Label>
                      <Input
                        type='datetime-local'
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
                        value={formData.scheduledFor}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            scheduledFor: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Data e Hora de Fim (Estimado)
                      </Label>
                      <Input
                        type='datetime-local'
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
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
                </Card>

                {/* Form Section 4: Partner Company Details (Conditional) */}
                <Card className='bg-primary/5 dark:bg-primary/10 p-6 rounded-xl border border-primary/20 dark:border-primary/30'>
                  <h2 className='text-gray-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                    Detalhes para Empresa Parceira
                  </h2>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Valor (R$)
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
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
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Tipo de Cobrança
                      </Label>
                      <Select
                        value={formData.chargeType}
                        onValueChange={(value: 'Por Hora' | 'Valor Fixo') =>
                          setFormData({ ...formData, chargeType: value })
                        }
                      >
                        <SelectTrigger className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='Por Hora'>Por Hora</SelectItem>
                          <SelectItem value='Valor Fixo'>Valor Fixo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Aprovado por
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
                        placeholder='Nome do aprovador'
                        value={formData.approvedBy}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            approvedBy: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className='flex flex-col'>
                      <Label className='text-gray-900 dark:text-white text-base font-medium leading-normal pb-2'>
                        Cliente Final
                      </Label>
                      <Input
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 h-14 placeholder:text-gray-500 dark:placeholder:text-gray-400 px-4 py-3 text-base font-normal leading-normal'
                        placeholder='Nome ou código do cliente final'
                        value={formData.finalClient}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            finalClient: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </Card>

                {/* Action Buttons */}
                <div className='flex justify-end items-center gap-4 pt-4'>
                  <Button
                    type='button'
                    variant='ghost'
                    className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-transparent text-gray-600 dark:text-gray-300 text-base font-bold leading-normal tracking-[0.015em] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
                    onClick={() => setLocation('/chamados')}
                  >
                    <span className='truncate'>Cancelar</span>
                  </Button>
                  <Button
                    type='submit'
                    className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors'
                    disabled={createMutation.isPending}
                  >
                    <span className='truncate'>
                      {createMutation.isPending
                        ? 'Salvando...'
                        : 'Salvar Chamado'}
                    </span>
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
























