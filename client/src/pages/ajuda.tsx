import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BookOpen,
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  FileText,
  Send,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

type MessageCategory = 'bug' | 'sugestao' | 'duvida' | 'outro';

const categoryLabels: Record<MessageCategory, string> = {
  bug: 'Bug/Erro',
  sugestao: 'Sugestão',
  duvida: 'Dúvida',
  outro: 'Outro',
};

const categoryIcons: Record<MessageCategory, typeof Bug> = {
  bug: Bug,
  sugestao: Lightbulb,
  duvida: HelpCircle,
  outro: MessageSquare,
};

export default function Ajuda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<
    'tutorial' | 'contato' | 'faq' | 'minhas-mensagens'
  >('tutorial');
  const [category, setCategory] = useState<MessageCategory>('duvida');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiRequest('POST', '/api/support/message', {
        category,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao enviar mensagem');
      }

      setSubmitted(true);
      setSubject('');
      setMessage('');
      setCategory('duvida');

      toast({
        title: 'Mensagem enviada!',
        description:
          'Sua mensagem foi enviada com sucesso. Responderemos em breve.',
      });

      setTimeout(() => {
        setSubmitted(false);
      }, 5000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Não foi possível enviar a mensagem.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-background p-6'>
      <div className='max-w-6xl mx-auto space-y-6'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Button
              variant='outline'
              onClick={() => navigate('/')}
              className='flex items-center gap-2'
            >
              <ArrowLeft className='w-4 h-4' />
              Voltar
            </Button>
            <div>
              <h1 className='text-3xl font-bold tracking-tight'>
                Central de Ajuda
              </h1>
              <p className='text-muted-foreground mt-2'>
                Encontre respostas e entre em contato com nosso suporte
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className='flex gap-2 border-b'>
          <button
            onClick={() => setActiveTab('tutorial')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'tutorial'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className='flex items-center gap-2'>
              <BookOpen className='w-4 h-4' />
              Tutorial
            </div>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'faq'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className='flex items-center gap-2'>
              <HelpCircle className='w-4 h-4' />
              Perguntas e Respostas
            </div>
          </button>
          <button
            onClick={() => setActiveTab('minhas-mensagens')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'minhas-mensagens'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className='flex items-center gap-2'>
              <MessageSquare className='w-4 h-4' />
              Minhas Mensagens
            </div>
          </button>
          <button
            onClick={() => setActiveTab('contato')}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'contato'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className='flex items-center gap-2'>
              <Send className='w-4 h-4' />
              Enviar Mensagem
            </div>
          </button>
        </div>

        {/* Conteúdo */}
        {activeTab === 'tutorial' && (
          <div className='grid gap-6 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <FileText className='w-5 h-5' />
                  Como Começar
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <h3 className='font-semibold mb-2'>
                    1. Cadastro e Configuração
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Após criar sua conta, complete seu cadastro com CPF/CNPJ e
                    dados da empresa. Isso é necessário para gerar sua URL
                    personalizada e configurar o sistema.
                  </p>
                </div>
                <div>
                  <h3 className='font-semibold mb-2'>2. Cadastrar Clientes</h3>
                  <p className='text-sm text-muted-foreground'>
                    Acesse a seção "Clientes" e cadastre seus clientes. Você
                    pode cadastrar manualmente ou importar em massa via XML.
                  </p>
                </div>
                <div>
                  <h3 className='font-semibold mb-2'>3. Criar Serviços</h3>
                  <p className='text-sm text-muted-foreground'>
                    Defina os serviços que você oferece com valores e durações.
                    Esses serviços aparecerão no agendamento público.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <MessageSquare className='w-5 h-5' />
                  Gerenciar Chamados
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <h3 className='font-semibold mb-2'>Criar Chamado</h3>
                  <p className='text-sm text-muted-foreground'>
                    Na seção "Chamados", clique em "Novo Chamado" e preencha as
                    informações. Você pode vincular a um cliente existente ou
                    criar um novo.
                  </p>
                </div>
                <div>
                  <h3 className='font-semibold mb-2'>Acompanhar Status</h3>
                  <p className='text-sm text-muted-foreground'>
                    Os chamados podem ter diferentes status: Aberto, Em
                    Andamento, Concluído, Cancelado. Use o cronômetro para
                    registrar o tempo trabalhado.
                  </p>
                </div>
                <div>
                  <h3 className='font-semibold mb-2'>Finalizar e Faturar</h3>
                  <p className='text-sm text-muted-foreground'>
                    Ao finalizar um chamado, você pode registrar o pagamento e
                    gerar relatórios financeiros.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <FileText className='w-5 h-5' />
                  Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <h3 className='font-semibold mb-2'>Dashboard Financeiro</h3>
                  <p className='text-sm text-muted-foreground'>
                    Acesse "Financeiro" para ver receitas, despesas e relatórios
                    detalhados. Os dados são atualizados automaticamente
                    conforme você registra pagamentos.
                  </p>
                </div>
                <div>
                  <h3 className='font-semibold mb-2'>Relatórios</h3>
                  <p className='text-sm text-muted-foreground'>
                    Gere relatórios personalizados por período, cliente ou tipo
                    de serviço. Exporte para PDF ou Excel.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <MessageSquare className='w-5 h-5' />
                  Agendamento Público
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <h3 className='font-semibold mb-2'>
                    Configurar Link Público
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Seus clientes podem agendar serviços através do link
                    público. Acesse "Agendamento Público" para configurar e
                    compartilhar seu link.
                  </p>
                </div>
                <div>
                  <h3 className='font-semibold mb-2'>
                    Sincronizar com Google Calendar
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Conecte sua conta do Google Calendar para sincronizar
                    automaticamente os agendamentos e evitar conflitos de
                    horário.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'contato' && (
          <Card>
            <CardHeader>
              <CardTitle>Enviar Mensagem ao Suporte</CardTitle>
              <p className='text-sm text-muted-foreground mt-2'>
                Envie sua dúvida, sugestão ou reporte um problema. Responderemos
                o mais breve possível.
              </p>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <Alert className='bg-green-50 border-green-200'>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                  <AlertTitle className='text-green-900'>
                    Mensagem enviada!
                  </AlertTitle>
                  <AlertDescription className='text-green-800'>
                    Sua mensagem foi enviada com sucesso. Nossa equipe entrará
                    em contato em breve através do email{' '}
                    <strong>{user?.email}</strong>.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleSubmit} className='space-y-6'>
                  <div className='space-y-2'>
                    <Label htmlFor='category'>Categoria *</Label>
                    <Select
                      value={category}
                      onValueChange={(value) =>
                        setCategory(value as MessageCategory)
                      }
                    >
                      <SelectTrigger id='category'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => {
                          const Icon = categoryIcons[key as MessageCategory];
                          return (
                            <SelectItem key={key} value={key}>
                              <div className='flex items-center gap-2'>
                                <Icon className='w-4 h-4' />
                                {label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='subject'>Assunto *</Label>
                    <Input
                      id='subject'
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder='Ex: Problema ao criar chamado'
                      required
                      maxLength={255}
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='message'>Mensagem *</Label>
                    <Textarea
                      id='message'
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder='Descreva sua dúvida, sugestão ou problema em detalhes...'
                      required
                      rows={8}
                      className='resize-none'
                    />
                    <p className='text-xs text-muted-foreground'>
                      {message.length} caracteres
                    </p>
                  </div>

                  <Button
                    type='submit'
                    disabled={
                      isSubmitting || !subject.trim() || !message.trim()
                    }
                    className='w-full'
                  >
                    {isSubmitting ? (
                      <>
                        <Send className='w-4 h-4 mr-2 animate-pulse' />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className='w-4 h-4 mr-2' />
                        Enviar Mensagem
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'faq' && <FaqSection />}
        {activeTab === 'minhas-mensagens' && <MyMessagesSection />}
      </div>
    </div>
  );
}

// Componente de FAQ (Perguntas e Respostas)
function FaqSection() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: faqItems, isLoading } = useQuery<any[]>({
    queryKey: ['/api/support/faq', searchTerm, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const response = await apiRequest(
        'GET',
        `/api/support/faq?${params.toString()}`,
        undefined
      );
      if (!response.ok) return [];
      return response.json();
    },
  });

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      bug: 'Bug/Erro',
      sugestao: 'Sugestão',
      duvida: 'Dúvida',
      outro: 'Outro',
    };
    return categoryMap[category] || category;
  };

  const categoryIcons: Record<string, typeof Bug> = {
    bug: Bug,
    sugestao: Lightbulb,
    duvida: HelpCircle,
    outro: MessageSquare,
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Perguntas e Respostas Frequentes</CardTitle>
          <p className='text-sm text-muted-foreground mt-2'>
            Encontre respostas para dúvidas comuns. Use a busca para encontrar
            tópicos específicos.
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-2'>
            <div className='flex-1'>
              <Input
                placeholder='Buscar perguntas e respostas...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas as Categorias</SelectItem>
                <SelectItem value='bug'>Bug/Erro</SelectItem>
                <SelectItem value='sugestao'>Sugestão</SelectItem>
                <SelectItem value='duvida'>Dúvida</SelectItem>
                <SelectItem value='outro'>Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className='text-center py-8'>Carregando...</div>
          ) : faqItems && faqItems.length > 0 ? (
            <div className='space-y-4'>
              {faqItems.map((item: any) => {
                const Icon = categoryIcons[item.category] || MessageSquare;
                return (
                  <Card key={item.id} className='p-4'>
                    <div className='flex items-start gap-3 mb-3'>
                      <Icon className='w-5 h-5 text-gray-400 mt-1 flex-shrink-0' />
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-2'>
                          <Badge variant='outline'>
                            {getCategoryLabel(item.category)}
                          </Badge>
                          <span className='text-xs text-muted-foreground'>
                            {format(new Date(item.created_at), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <h4 className='font-semibold text-lg mb-2'>
                          {item.subject}
                        </h4>
                        <div className='mb-3'>
                          <p className='text-sm text-muted-foreground mb-1'>
                            <strong>Pergunta:</strong>
                          </p>
                          <p className='text-sm whitespace-pre-wrap'>
                            {item.message}
                          </p>
                        </div>
                        <div className='p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                          <p className='text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1'>
                            Resposta:
                          </p>
                          <p className='text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap'>
                            {item.admin_response}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className='text-center py-8 text-muted-foreground'>
              {searchTerm
                ? 'Nenhuma pergunta encontrada com os filtros selecionados.'
                : 'Ainda não há perguntas e respostas disponíveis. Envie uma mensagem e nossa equipe responderá!'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de Minhas Mensagens
function MyMessagesSection() {
  const { toast } = useToast();

  const {
    data: messages,
    isLoading,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['/api/support/my-messages'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/support/my-messages',
        undefined
      );
      if (!response.ok) return [];
      return response.json();
    },
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });

  const handleMarkAsRead = async (messageId: string) => {
    try {
      const response = await apiRequest(
        'POST',
        `/api/support/messages/${messageId}/mark-read`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao marcar como lida');
      toast({
        title: 'Mensagem marcada como lida',
        description: 'A mensagem foi marcada como lida.',
      });
      refetch();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Erro ao marcar como lida',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      aberto: {
        label: 'Aberto',
        className:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      },
      em_andamento: {
        label: 'Em Andamento',
        className:
          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      },
      resolvido: {
        label: 'Resolvido',
        className:
          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      },
      fechado: {
        label: 'Fechado',
        className:
          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      },
    };
    const statusInfo = statusMap[status] || statusMap.aberto;
    return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      bug: 'Bug/Erro',
      sugestao: 'Sugestão',
      duvida: 'Dúvida',
      outro: 'Outro',
    };
    return categoryMap[category] || category;
  };

  const categoryIcons: Record<string, typeof Bug> = {
    bug: Bug,
    sugestao: Lightbulb,
    duvida: HelpCircle,
    outro: MessageSquare,
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className='py-8'>
          <div className='text-center'>Carregando suas mensagens...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Minhas Mensagens de Suporte</CardTitle>
          <p className='text-sm text-muted-foreground mt-2'>
            Visualize todas as mensagens que você enviou e as respostas da nossa
            equipe.
          </p>
        </CardHeader>
        <CardContent>
          {messages && messages.length > 0 ? (
            <div className='space-y-4'>
              {messages.map((message: any) => {
                const Icon = categoryIcons[message.category] || MessageSquare;
                const hasUnreadResponse =
                  message.admin_response && !message.user_read_at;
                return (
                  <Card
                    key={message.id}
                    className={`p-4 ${
                      hasUnreadResponse ? 'border-blue-500 border-2' : ''
                    }`}
                  >
                    <div className='flex items-start justify-between mb-3'>
                      <div className='flex items-center gap-3'>
                        <Icon className='w-5 h-5 text-gray-400' />
                        <div>
                          <div className='flex items-center gap-2 mb-1'>
                            <h4 className='font-semibold'>{message.subject}</h4>
                            {hasUnreadResponse && (
                              <Badge className='bg-blue-500 text-white'>
                                Nova Resposta!
                              </Badge>
                            )}
                          </div>
                          <p className='text-sm text-muted-foreground'>
                            {getCategoryLabel(message.category)} •{' '}
                            {format(
                              new Date(message.created_at),
                              'dd/MM/yyyy HH:mm',
                              {
                                locale: ptBR,
                              }
                            )}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(message.status)}
                    </div>
                    <div className='mb-3'>
                      <p className='text-sm font-semibold mb-1'>
                        Sua mensagem:
                      </p>
                      <p className='text-sm whitespace-pre-wrap'>
                        {message.message}
                      </p>
                    </div>
                    {message.admin_response && (
                      <div className='mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
                        <p className='text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1'>
                          Resposta da Equipe:
                        </p>
                        <p className='text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap'>
                          {message.admin_response}
                        </p>
                        {message.responded_at && (
                          <p className='text-xs text-blue-600 dark:text-blue-400 mt-2'>
                            Respondido em:{' '}
                            {format(
                              new Date(message.responded_at),
                              'dd/MM/yyyy HH:mm',
                              {
                                locale: ptBR,
                              }
                            )}
                          </p>
                        )}
                        {hasUnreadResponse && (
                          <Button
                            onClick={() => handleMarkAsRead(message.id)}
                            size='sm'
                            className='mt-2'
                            variant='outline'
                          >
                            Marcar como lida
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className='text-center py-8 text-muted-foreground'>
              Você ainda não enviou nenhuma mensagem. Use a aba "Enviar
              Mensagem" para entrar em contato conosco.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
