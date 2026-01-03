import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import {
  Search,
  Plus,
  Download,
  Printer,
  MessageCircle,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Calendar,
} from 'lucide-react';
import { maskCurrency, unmaskCurrency } from '@/lib/masks';
import { useAuth } from '@/hooks/use-auth';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
  defaultTicketValue?: string;
  defaultKmRate?: string;
  defaultHoursIncluded?: number;
  defaultAdditionalHourRate?: string;
  ratTemplateId?: string; // Default RAT template
}

interface ServiceOrderTemplate {
  id: string;
  name: string;
}

interface Technician {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status?: 'available' | 'busy' | 'unavailable';
  workload?: {
    availabilityStatus: 'available' | 'busy' | 'full';
    availabilityText: string;
    availabilityColor: string;
  };
  defaultDailyRate?: string; // Valor padrão diária
  defaultHourlyRate?: string; // Valor padrão avulso/hora
}

interface CreatedTicket {
  id: string;
  ticketNumber: string;
}

interface ServiceOrder {
  id: string;
  publicToken?: string | null;
  status?: string | null;
}

export default function CriacaoChamadoEmpresa() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const { user } = useAuth();
  const [createdTicket, setCreatedTicket] = useState<CreatedTicket | null>(null);
  const [createdServiceOrder, setCreatedServiceOrder] =
    useState<ServiceOrder | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCustomFields, setShowCustomFields] = useState(false);

  const [formData, setFormData] = useState({
    clientId: '',
    ticketNumber: '',
    sla: '',
    serviceOrderTemplateId: '',
    address: '',
    technicianId: '',
    scheduledFor: '',
    chargeType: 'AVULSO' as 'DIARIA' | 'AVULSO',
    ticketValue: '',
    description: '',
  });

  // Buscar próximo número de chamado
  const { data: nextTicketNumber } = useQuery<string>({
    queryKey: ['/api/tickets/next-number'],
    enabled: !formData.ticketNumber,
  });

  // Atualizar número do chamado quando disponível
  useEffect(() => {
    if (nextTicketNumber && !formData.ticketNumber) {
      setFormData((prev) => ({ ...prev, ticketNumber: nextTicketNumber }));
    }
  }, [nextTicketNumber, formData.ticketNumber]);

  // Buscar clientes
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients', undefined);
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    },
  });

  const { data: serviceOrderTemplates = [] } = useQuery<ServiceOrderTemplate[]>(
    {
      queryKey: ['/api/service-order-templates'],
      queryFn: async () => {
        const response = await apiRequest(
          'GET',
          '/api/service-order-templates',
          undefined
        );
        if (!response.ok) throw new Error('Erro ao carregar templates');
        return response.json();
      },
    }
  );

  // Buscar técnicos parceiros/internos
  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ['/api/company/technicians/with-stats'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/company/technicians/with-stats',
        undefined
      );
      if (!response.ok) {
        // Fallback para rota sem stats
        const fallbackResponse = await apiRequest(
          'GET',
          '/api/company/technicians',
          undefined
        );
        if (!fallbackResponse.ok) return [];
        return fallbackResponse.json();
      }
      return response.json();
    },
    enabled: !!user && user.role === 'company',
  });

  // Filtrar clientes por busca
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch) return [];

    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        client.phone?.includes(clientSearch)
    );
  }, [clients, clientSearch]);

  // Quando cliente é selecionado, preencher dados automaticamente
  useEffect(() => {
    if (formData.clientId && clients) {
      const client = clients.find((c) => c.id === formData.clientId);
      if (client) {
        setSelectedClient(client);
        setFormData((prev) => ({
          ...prev,
          address: client.address || '',
          serviceOrderTemplateId: client.ratTemplateId || '',
        }));
        setClientSearch(client.name);
      }
    }
  }, [formData.clientId, clients]);

  // Quando técnico é selecionado, preencher valor padrão
  useEffect(() => {
    if (formData.technicianId && technicians) {
      const technician = technicians.find((t) => t.id === formData.technicianId);
      if (technician) {
        const defaultValue =
          formData.chargeType === 'DIARIA'
            ? technician.defaultDailyRate
            : technician.defaultHourlyRate;

        if (defaultValue) {
          setFormData((prev) => ({
            ...prev,
            ticketValue: maskCurrency(defaultValue),
          }));
        }
      }
    }
  }, [formData.technicianId, formData.chargeType, technicians]);

  // Quando tipo de cobrança muda, atualizar valor
  useEffect(() => {
    if (formData.technicianId && technicians) {
      const technician = technicians.find((t) => t.id === formData.technicianId);
      if (technician) {
        const defaultValue =
          formData.chargeType === 'DIARIA'
            ? technician.defaultDailyRate
            : technician.defaultHourlyRate;

        if (defaultValue) {
          setFormData((prev) => ({
            ...prev,
            ticketValue: maskCurrency(defaultValue),
          }));
        }
      }
    }
  }, [formData.chargeType, formData.technicianId, technicians]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Converter scheduledFor para formato esperado pelo backend
      const scheduledDate = data.scheduledFor
        ? new Date(data.scheduledFor).toISOString()
        : new Date().toISOString();
      const scheduledTime = data.scheduledFor
        ? new Date(data.scheduledFor).toTimeString().slice(0, 5)
        : new Date().toTimeString().slice(0, 5);

      const payload = {
        clientId: data.clientId,
        ticketNumber: data.ticketNumber,
        serviceAddress: data.address,
        scheduledDate,
        scheduledTime,
        description: data.description,
        technicianId: data.technicianId || undefined,
        ticketValue: unmaskCurrency(data.ticketValue),
        chargeType: data.chargeType,
        // Campos adicionais
        sla: data.sla ? parseInt(data.sla, 10) : undefined,
        serviceOrderTemplateId: data.serviceOrderTemplateId || undefined,
      };

      const response = await apiRequest('POST', '/api/tickets', payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao criar chamado');
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      setCreatedTicket({
        id: data.id,
        ticketNumber: formData.ticketNumber,
      });
      setCreatedServiceOrder(null);
      if (data.id && formData.serviceOrderTemplateId) {
        try {
          const response = await apiRequest(
            'GET',
            `/api/service-orders/by-ticket/${data.id}`,
            undefined
          );
          if (response.ok) {
            const order = await response.json();
            setCreatedServiceOrder(order);
          }
        } catch (orderError) {
          console.error('Erro ao carregar ordem de servico:', orderError);
        }
      }
      toast({
        title: 'Chamado criado com sucesso!',
        description: `O chamado ${formData.ticketNumber} foi criado.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar chamado',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId || !formData.scheduledFor || !formData.description) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const getServiceOrderLink = () => {
    if (!createdServiceOrder?.publicToken) return '';
    return `${window.location.origin}/rat/${createdServiceOrder.publicToken}`;
  };

  const handleDownloadRAT = () => {
    if (!createdTicket) return;
    const link = getServiceOrderLink();
    if (!link) {
      toast({
        variant: 'destructive',
        title: 'RAT indisponivel',
        description: 'Nenhum modelo de RAT foi associado ao chamado.',
      });
      return;
    }
    window.open(link, '_blank');
  };

  const handlePrintRAT = () => {
    if (!createdTicket) return;
    const link = getServiceOrderLink();
    if (!link) {
      toast({
        variant: 'destructive',
        title: 'RAT indisponivel',
        description: 'Nenhum modelo de RAT foi associado ao chamado.',
      });
      return;
    }
    window.open(`${link}?print=1`, '_blank');
  };

  const handleSendWhatsApp = () => {
    if (
      !requirePaid({
        feature: 'Envio por WhatsApp',
        description: 'Envios por WhatsApp estao disponiveis apenas na versao paga.',
      })
    ) {
      return;
    }
    if (!createdTicket || !selectedClient) return;
    const link = getServiceOrderLink();
    if (!link) {
      toast({
        variant: 'destructive',
        title: 'RAT indisponivel',
        description: 'Nenhum modelo de RAT foi associado ao chamado.',
      });
      return;
    }
    const message = encodeURIComponent(
      `Chamado ${createdTicket.ticketNumber} criado. Assine a RAT aqui: ${link}`
    );
    const phone = selectedClient.phone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  if (createdTicket) {
    return (
      <div className='flex min-h-screen bg-[#f5f7f8] dark:bg-[#101722]'>
        <main className='flex-1 p-8 overflow-y-auto'>
          <div className='max-w-4xl mx-auto'>
            <Card className='bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 p-8 rounded-xl'>
              <div className='flex items-center gap-3 mb-6'>
                <CheckCircle2 className='w-8 h-8 text-green-600 dark:text-green-400' />
                <h2 className='text-2xl font-bold text-green-900 dark:text-green-100'>
                  Chamado Criado com Sucesso!
                </h2>
              </div>
              <p className='text-gray-700 dark:text-gray-300 mb-6'>
                O chamado <strong>{createdTicket.ticketNumber}</strong> foi
                criado. Escolha uma das ações abaixo:
              </p>
              <div className='flex flex-wrap gap-4'>
                <Button
                  onClick={handleDownloadRAT}
                  className='bg-blue-600 hover:bg-blue-700 text-white'
                >
                  <Download className='w-4 h-4 mr-2' />
                  Download da RAT (PDF)
                </Button>
                <Button
                  onClick={handlePrintRAT}
                  className='bg-blue-600 hover:bg-blue-700 text-white'
                >
                  <Printer className='w-4 h-4 mr-2' />
                  Imprimir RAT
                </Button>
                <Button
                  onClick={handleSendWhatsApp}
                  className='bg-green-600 hover:bg-green-700 text-white'
                >
                  <MessageCircle className='w-4 h-4 mr-2' />
                  Enviar via WhatsApp
                </Button>
                <Button
                  variant='outline'
                  onClick={() => setLocation('/chamados')}
                >
                  Voltar para Chamados
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    );
  }

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
                Modo Empresa: Preencha os detalhes para registrar um novo
                chamado.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className='space-y-8'>
            {/* Informações do Cliente */}
            <Card className='bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 p-6 rounded-xl'>
              <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                Informações do Cliente
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col min-w-40 flex-1'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Cliente*
                  </Label>
                  <div className='relative'>
                    <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 w-5 h-5' />
                    <Input
                      className='pl-12 h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:ring-primary/50'
                      placeholder='Buscar e selecionar cliente...'
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onFocus={() => setClientSearch('')}
                    />
                    {clientSearch &&
                      filteredClients &&
                      filteredClients.length > 0 && (
                        <div className='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg max-h-60 overflow-y-auto shadow-lg'>
                          {filteredClients.map((client) => (
                            <button
                              key={client.id}
                              type='button'
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  clientId: client.id,
                                });
                                setSelectedClient(client);
                                setClientSearch(client.name);
                              }}
                              className='w-full text-left px-4 py-3 text-[#111418] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0'
                            >
                              <div className='font-medium'>{client.name}</div>
                              <div className='text-sm text-gray-500 dark:text-gray-400'>
                                {client.email} • {client.phone}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
                <div className='flex flex-col min-w-40 flex-1'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Número do Chamado
                  </Label>
                  <Input
                    className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white'
                    value={formData.ticketNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        ticketNumber: e.target.value,
                      })
                    }
                    placeholder='CH-20240001'
                  />
                </div>
                <div className='flex flex-col min-w-40 flex-1 md:col-span-2'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Endereço do Cliente
                  </Label>
                  <Input
                    className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400'
                    placeholder='Selecione um cliente para carregar o endereço'
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    disabled={!selectedClient}
                  />
                </div>
              </div>
            </Card>

            {/* Detalhes do Serviço */}
            <Card className='bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 p-6 rounded-xl'>
              <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                Detalhes do Serviço
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    RAT Cadastrada (modelo)
                  </Label>
                  <Select
                    value={formData.serviceOrderTemplateId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, serviceOrderTemplateId: value })
                    }
                    disabled={!selectedClient}
                  >
                    <SelectTrigger className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white'>
                      <SelectValue placeholder='Selecione um cliente para carregar...' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=''>Nenhum</SelectItem>
                      {serviceOrderTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex flex-col'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    <div className='flex items-center gap-2'>
                      <Clock className='w-4 h-4' />
                      SLA (horas para atendimento)
                    </div>
                  </Label>
                  <Input
                    type='number'
                    className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white'
                    placeholder='Ex: 8'
                    value={formData.sla}
                    onChange={(e) =>
                      setFormData({ ...formData, sla: e.target.value })
                    }
                    min='1'
                  />
                </div>
                <div className='flex flex-col md:col-span-2'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Descrição do Chamado*
                  </Label>
                  <Textarea
                    className='min-h-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400'
                    placeholder='Descreva o problema ou a solicitação do cliente...'
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>
                <div className='md:col-span-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setShowCustomFields(!showCustomFields)}
                    className='w-full'
                  >
                    <Plus className='w-4 h-4 mr-2' />
                    // Adicionar Campos Personalizados do Editor de OS
                  </Button>
                  {showCustomFields && (
                    <div className='mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                      <p className='text-sm text-gray-600 dark:text-gray-400'>
                        Funcionalidade de campos personalizados em
                        desenvolvimento.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Agendamento e Atribuição */}
            <Card className='bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 p-6 rounded-xl'>
              <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                Agendamento e Atribuição
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    <div className='flex items-center gap-2'>
                      <Calendar className='w-4 h-4' />
                      Data e Hora de Início*
                    </div>
                  </Label>
                  <Input
                    type='datetime-local'
                    className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white'
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
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    <div className='flex items-center gap-2'>
                      <User className='w-4 h-4' />
                      Atribuir Técnico
                    </div>
                  </Label>
                  <Select
                    value={formData.technicianId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, technicianId: value })
                    }
                  >
                    <SelectTrigger className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white'>
                      <SelectValue placeholder='Selecione um técnico' />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians?.map((tech) => {
                        const availability =
                          tech.workload?.availabilityStatus || 'available';
                        const availabilityText =
                          tech.workload?.availabilityText || 'Disponível';
                        const availabilityColor =
                          tech.workload?.availabilityColor || 'green';

                        return (
                          <SelectItem key={tech.id} value={tech.id}>
                            <div className='flex items-center justify-between w-full'>
                              <span>
                                {tech.firstName} {tech.lastName}
                              </span>
                              <Badge
                                variant='outline'
                                className={`ml-2 ${
                                  availability === 'available'
                                    ? 'border-green-500 text-green-700 dark:text-green-400'
                                    : availability === 'busy'
                                    ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                                    : 'border-red-500 text-red-700 dark:text-red-400'
                                }`}
                              >
                                {availabilityText}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Detalhes Financeiros */}
            <Card className='bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 p-6 rounded-xl'>
              <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-5'>
                Detalhes Financeiros
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='flex flex-col'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Tipo de Valor
                  </Label>
                  <Select
                    value={formData.chargeType}
                    onValueChange={(value: 'DIARIA' | 'AVULSO') =>
                      setFormData({ ...formData, chargeType: value })
                    }
                  >
                    <SelectTrigger className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='DIARIA'>Diária</SelectItem>
                      <SelectItem value='AVULSO'>Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='flex flex-col'>
                  <Label className='text-[#111418] dark:text-white text-base font-medium leading-normal pb-2'>
                    Valor do Chamado (R$)
                  </Label>
                  <Input
                    className='h-14 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#111418] dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400'
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
            </Card>

            <div className='flex justify-end items-center gap-4 pt-4'>
              <Button
                type='button'
                variant='ghost'
                className='h-12 px-6 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                onClick={() => setLocation('/chamados')}
              >
                Cancelar
              </Button>
              <Button
                type='submit'
                className='h-12 px-6 bg-[#3880f5] hover:bg-[#3880f5]/90'
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Criando...' : 'Criar Chamado'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}