import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  Search,
  Send,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Company {
  id: string;
  name: string;
  category: string;
  // logo?: string;
}

interface Invitation {
  id: string;
  companyName: string;
  companyId: string;
  status: 'PENDENTE' | 'ACEITO' | 'RECUSADO';
  sentAt: string;
  receivedAt?: string;
  message?: string;
  conditions?: string[];
  companyLogo?: string;
}

export default function GestaoConvites() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);
  const [showRejectionReason, setShowRejectionReason] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Se não for empresa, não renderizar
  if (!user || user.role !== 'company') {
    return null;
  }

  const { data: companies, error: companiesError } = useQuery<Company[]>({
    queryKey: ['/api/companies/available'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/companies/available',
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar empresas');
      return response.json();
    },
  });

  const { data: invitations, error: invitationsError } = useQuery<Invitation[]>(
    {
      queryKey: ['/api/invitations', activeTab],
      queryFn: async () => {
        const response = await apiRequest(
          'GET',
          `/api/invitations?type=${activeTab}`,
          undefined
        );
        if (!response.ok) throw new Error('Erro ao carregar convites');
        return response.json();
      },
    }
  );

  const sendInvitationMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const response = await apiRequest('POST', '/api/invitations', {
        companyId,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar convite');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      toast({
        title: 'Convite enviado',
        description: 'O convite foi enviado com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar convite',
        description: error.message,
      });
    },
  });

  const respondInvitationMutation = useMutation({
    mutationFn: async ({
      invitationId,
      response: responseType,
      reason,
    }: {
      invitationId: string;
      response: 'accept' | 'reject';
      reason?: string;
    }) => {
      const response = await apiRequest(
        'PUT',
        `/api/invitations/${invitationId}/respond`,
        {
          response: responseType,
          reason,
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao responder convite');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
      setSelectedInvitation(null);
      setRejectionReason('');
      setShowRejectionReason(false);
      toast({
        title:
          variables.response === 'accept'
            ? 'Convite aceito'
            : 'Convite recusado',
        description: `O convite foi ${
          variables.response === 'accept' ? 'aceito' : 'recusado'
        } com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao responder convite',
        description: error.message,
      });
    },
  });

  const handleAcceptInvitation = () => {
    if (selectedInvitation) {
      respondInvitationMutation.mutate({
        invitationId: selectedInvitation.id,
        response: 'accept',
      });
    }
  };

  const handleRejectInvitation = () => {
    if (selectedInvitation) {
      if (!showRejectionReason) {
        setShowRejectionReason(true);
        return;
      }
      respondInvitationMutation.mutate({
        invitationId: selectedInvitation.id,
        response: 'reject',
        reason: rejectionReason || undefined,
      });
    }
  };

  const filteredCompanies = companies?.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTimeAgo = (date: string) => {
    const days = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 7) return `${days} dias atrás`;
    if (days < 30)
      return `${Math.floor(days / 7)} semana${
        Math.floor(days / 7) > 1 ? 's' : ''
      } atrás`;
    return `${Math.floor(days / 30)} mês${
      Math.floor(days / 30) > 1 ? 'es' : ''
    } atrás`;
  };

  // Se houver erro, mostrar mensagem
  if (companiesError || invitationsError) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-center min-h-[400px]'>
          <div className='text-center'>
            <p className='text-red-600 dark:text-red-400 text-lg font-semibold mb-2'>
              Erro ao carregar dados
            </p>
            <p className='text-gray-600 dark:text-gray-400'>
              {companiesError instanceof Error
                ? companiesError.message
                : invitationsError instanceof Error
                ? invitationsError.message
                : 'Erro desconhecido'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap justify-between gap-3 pb-6'>
        <h1 className='text-neutral-900 dark:text-neutral-50 text-4xl font-black leading-tight tracking-[-0.033em]'>
          Gestão de Convites
        </h1>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-5 gap-8'>
        {/* Left Column: Available Companies */}
        <div className='lg:col-span-3 flex flex-col gap-6'>
          <h2 className='text-neutral-900 dark:text-neutral-50 text-[22px] font-bold leading-tight tracking-[-0.015em]'>
            Encontrar Empresas Parceiras
          </h2>
          <div className='relative'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 w-5 h-5' />
            <Input
              className='w-full rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 h-12 pl-12 pr-4 focus:border-[#3880f5] focus:ring-[#3880f5]'
              placeholder='Buscar empresa por nome...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-2'>
            {filteredCompanies && filteredCompanies.length > 0 ? (
              filteredCompanies.map((company) => (
                <Card
                  key={company.id}
                  className='flex items-center gap-4 bg-white dark:bg-neutral-900 px-4 min-h-[72px] py-2 justify-between rounded-lg border border-neutral-200 dark:border-neutral-800'
                >
                  <div className='flex items-center gap-4'>
                    <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 bg-gray-300 dark:bg-gray-700'></div>
                    <div className='flex flex-col justify-center'>
                      <p className='text-neutral-900 dark:text-neutral-50 text-base font-medium leading-normal line-clamp-1'>
                        {company.name}
                      </p>
                      <p className='text-neutral-500 dark:text-neutral-400 text-sm font-normal leading-normal line-clamp-2'>
                        {company.category}
                      </p>
                    </div>
                  </div>
                  <div className='shrink-0'>
                    <Button
                      className='bg-[#3880f5] hover:bg-[#3880f5]/90'
                      size='sm'
                      onClick={() => sendInvitationMutation.mutate(company.id)}
                      disabled={sendInvitationMutation.isPending}
                    >
                      <Send className='w-4 h-4 mr-2' />
                      Enviar Convite
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <p className='text-center text-gray-500 dark:text-gray-400 py-8'>
                Nenhuma empresa encontrada
              </p>
            )}
          </div>
        </div>

        {/* Right Column: My Invites */}
        <div className='lg:col-span-2 flex flex-col gap-6'>
          <h2 className='text-neutral-900 dark:text-neutral-50 text-[22px] font-bold leading-tight tracking-[-0.015em]'>
            Meus Convites
          </h2>
          {/* Tabs */}
          <div className='border-b border-neutral-200 dark:border-neutral-800'>
            <nav className='flex -mb-px'>
              <button
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'received'
                    ? 'text-[#3880f5] border-[#3880f5]'
                    : 'text-neutral-500 dark:text-neutral-400 border-transparent hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
                onClick={() => setActiveTab('received')}
              >
                Convites Recebidos
              </button>
              <button
                className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'sent'
                    ? 'text-[#3880f5] border-[#3880f5]'
                    : 'text-neutral-500 dark:text-neutral-400 border-transparent hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
                onClick={() => setActiveTab('sent')}
              >
                Convites Enviados
              </button>
            </nav>
          </div>
          {/* Invites List */}
          <div className='flex flex-col gap-4'>
            {invitations && invitations.length > 0 ? (
              invitations.map((invitation) => (
                <Card
                  key={invitation.id}
                  className={`p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-col gap-3 ${
                    activeTab === 'received' && invitation.status === 'PENDENTE'
                      ? 'cursor-pointer hover:border-[#3880f5] transition-colors'
                      : ''
                  }`}
                  onClick={() => {
                    if (
                      activeTab === 'received' &&
                      invitation.status === 'PENDENTE'
                    ) {
                      setSelectedInvitation(invitation);
                      setShowRejectionReason(false);
                      setRejectionReason('');
                    }
                  }}
                >
                  <div className='flex items-start justify-between'>
                    <p className='text-neutral-800 dark:text-neutral-100 font-medium'>
                      {activeTab === 'received'
                        ? `Convite da ${invitation.companyName}`
                        : `Convite para ${invitation.companyName}`}
                    </p>
                    <span className='text-xs text-neutral-500 dark:text-neutral-400'>
                      {getTimeAgo(
                        activeTab === 'received'
                          ? invitation.receivedAt || invitation.sentAt
                          : invitation.sentAt
                      )}
                    </span>
                  </div>
                  {activeTab === 'received' &&
                  invitation.status === 'PENDENTE' ? (
                    <p className='text-sm text-neutral-500 dark:text-neutral-400'>
                      Clique para ver detalhes e responder
                    </p>
                  ) : (
                    <Badge
                      className={
                        invitation.status === 'ACEITO'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : invitation.status === 'RECUSADO'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                      }
                    >
                      {invitation.status === 'ACEITO'
                        ? 'Aceito'
                        : invitation.status === 'RECUSADO'
                        ? 'Recusado'
                        : 'Pendente'}
                    </Badge>
                  )}
                </Card>
              ))
            ) : (
              <p className='text-center text-gray-500 dark:text-gray-400 py-8'>
                Nenhum convite{' '}
                {activeTab === 'received' ? 'recebido' : 'enviado'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Convite de Parceria */}
      <Dialog
        open={!!selectedInvitation}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvitation(null);
            setShowRejectionReason(false);
            setRejectionReason('');
          }
        }}
      >
        <DialogContent className='sm:max-w-2xl'>
          {selectedInvitation && (
            <>
              <DialogHeader>
                <div className='flex items-start gap-4'>
                  <div className='w-16 h-16 rounded-full bg-[#3880f5] flex items-center justify-center text-white text-2xl font-bold'>
                    {selectedInvitation.companyLogo ? (
                      <img
                        src={selectedInvitation.companyLogo}
                        alt={selectedInvitation.companyName}
                        className='w-full h-full rounded-full object-cover'
                      />
                    ) : (
                      <Building2 className='w-8 h-8' />
                    )}
                  </div>
                  <div className='flex-1'>
                    <DialogTitle className='text-2xl font-semibold'>
                      Convite de Parceria
                    </DialogTitle>
                    <DialogDescription className='text-base mt-1'>
                      Enviado por {selectedInvitation.companyName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className='space-y-6 py-4'>
                {/* Mensagem do Convite */}
                <div>
                  <h3 className='text-lg font-semibold mb-2'>
                    Mensagem do Convite
                  </h3>
                  <p className='text-muted-foreground leading-relaxed'>
                    {selectedInvitation.message ||
                      `Olá, gostaríamos de convidá-lo para se juntar à nossa equipe de técnicos parceiros para atender à crescente demanda em sua região. Vimos seu perfil no ChamadosPro e ficamos impressionados com sua experiência e avaliações.`}
                  </p>
                </div>

                {/* Condições da Parceria */}
                {selectedInvitation.conditions &&
                  selectedInvitation.conditions.length > 0 && (
                    <div>
                      <h3 className='text-lg font-semibold mb-3'>
                        Condições da Parceria
                      </h3>
                      <ul className='space-y-2'>
                        {selectedInvitation.conditions.map(
                          (condition, index) => (
                            <li
                              key={index}
                              className='flex items-start gap-2 text-muted-foreground'
                            >
                              <span className='text-[#3880f5] mt-1'>•</span>
                              <span>{condition}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                {/* Condições padrão se não houver condições específicas */}
                {(!selectedInvitation.conditions ||
                  selectedInvitation.conditions.length === 0) && (
                  <div>
                    <h3 className='text-lg font-semibold mb-3'>
                      Condições da Parceria
                    </h3>
                    <ul className='space-y-2'>
                      <li className='flex items-start gap-2 text-muted-foreground'>
                        <span className='text-[#3880f5] mt-1'>•</span>
                        <span>
                          Comissão de 20% sobre o valor dos serviços concluídos
                        </span>
                      </li>
                      <li className='flex items-start gap-2 text-muted-foreground'>
                        <span className='text-[#3880f5] mt-1'>•</span>
                        <span>
                          Acesso à nossa plataforma de gestão de chamados
                        </span>
                      </li>
                      <li className='flex items-start gap-2 text-muted-foreground'>
                        <span className='text-[#3880f5] mt-1'>•</span>
                        <span>
                          Suporte prioritário da nossa equipe de operações
                        </span>
                      </li>
                      <li className='flex items-start gap-2 text-muted-foreground'>
                        <span className='text-[#3880f5] mt-1'>•</span>
                        <span>Flexibilidade de horários</span>
                      </li>
                    </ul>
                  </div>
                )}

                {/* Campo de Justificativa para Recusa */}
                {showRejectionReason && (
                  <div>
                    <label className='text-sm font-medium mb-2 block'>
                      Justificativa (opcional)
                    </label>
                    <Textarea
                      placeholder='Informe o motivo da recusa, se desejar...'
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className='resize-none'
                    />
                  </div>
                )}
              </div>

              <DialogFooter className='flex-col sm:flex-row gap-3'>
                <Button
                  variant='outline'
                  className='w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-red-600'
                  onClick={handleRejectInvitation}
                  disabled={respondInvitationMutation.isPending}
                >
                  <ThumbsDown className='w-4 h-4 mr-2' />
                  {showRejectionReason ? 'Confirmar Recusa' : 'Recusar Convite'}
                </Button>
                <Button
                  className='w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white'
                  onClick={handleAcceptInvitation}
                  disabled={respondInvitationMutation.isPending}
                >
                  <ThumbsUp className='w-4 h-4 mr-2' />
                  Aceitar Convite
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}