import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Eye,
  Edit,
  FileText,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  ArrowUpRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { maskCPF, maskCNPJ, maskPhone } from '@/lib/masks';
import { useLocation } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

interface Client {
  id: string;
  name: string;
  type: 'PF' | 'PJ' | 'EMPRESA_PARCEIRA';
  document: string;
  email: string;
  phone: string;
  legalName?: string | null;
  city: string;
  state: string;
}

export default function GestaoClientesEmpresa() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PF' | 'PJ'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const itemsPerPage = 10;

  // Buscar apenas clientes PF e PJ (não EMPRESA_PARCEIRA)
  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients', undefined);
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    },
  });

  // Filtrar apenas PF e PJ
  const companyClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter(
      (client) => client.type === 'PF' || client.type === 'PJ'
    );
  }, [clients]);

  // Filtrar por busca e tipo
  const filteredClients = useMemo(() => {
    if (!companyClients) return [];

    return companyClients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.legalName &&
          client.legalName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm) ||
        client.document
          .replace(/\D/g, '')
          .includes(searchTerm.replace(/\D/g, ''));

      const matchesType = typeFilter === 'ALL' || client.type === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [companyClients, searchTerm, typeFilter]);

  // Paginação
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredClients.slice(startIndex, endIndex);
  }, [filteredClients, currentPage]);

  // Contadores por tipo
  const clientCounts = useMemo(() => {
    return {
      total: companyClients.length,
      PF: companyClients.filter((c) => c.type === 'PF').length,
      PJ: companyClients.filter((c) => c.type === 'PJ').length,
    };
  }, [companyClients]);

  const handleCreateClient = () => {
    setLocation('/clientes');
  };

  const handleViewDetails = (client: Client) => {
    setViewingClient(client);
  };

  const handleEdit = (client: Client) => {
    setLocation(`/clientes?edit=${client.id}`);
  };

  const handleOpenTicket = (client: Client) => {
    setLocation(`/criacao-chamado?clientId=${client.id}`);
  };

  const getMainContact = (client: Client): string => {
    if (client.email) return client.email;
    if (client.phone) return maskPhone(client.phone);
    return 'N/A';
  };

  return (
    <div className='relative flex h-auto w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display'>
      <div className='space-y-6 p-6'>
        {/* Header */}
        <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
              Gestão de Clientes
            </h1>
            <p className='text-muted-foreground mt-1'>
              Gerencie seus clientes Pessoa Física e Pessoa Jurídica
            </p>
          </div>
          <Button
            onClick={handleCreateClient}
            className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
          >
            <Plus className='h-4 w-4 mr-2' />
            Cadastrar Novo Cliente
          </Button>
        </div>

        {/* Busca e Filtros */}
        <div className='space-y-4'>
          {/* Busca */}
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
            <Input
              placeholder='Buscar por nome ou documento...'
              className='pl-10 h-12'
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Resetar para primeira página ao buscar
              }}
            />
          </div>

          {/* Filtros por Tipo */}
          <div className='flex gap-2'>
            <Button
              variant={typeFilter === 'ALL' ? 'default' : 'outline'}
              onClick={() => {
                setTypeFilter('ALL');
                setCurrentPage(1);
              }}
              className='h-10'
            >
              // Todos
              {typeFilter === 'ALL' && (
                <Badge variant='secondary' className='ml-2'>
                  {clientCounts.total}
                </Badge>
              )}
            </Button>
            <Button
              variant={typeFilter === 'PF' ? 'default' : 'outline'}
              onClick={() => {
                setTypeFilter('PF');
                setCurrentPage(1);
              }}
              className='h-10'
            >
              <User className='h-4 w-4 mr-2' />
              Pessoa Física
              {typeFilter === 'PF' && (
                <Badge variant='secondary' className='ml-2'>
                  {clientCounts.PF}
                </Badge>
              )}
            </Button>
            <Button
              variant={typeFilter === 'PJ' ? 'default' : 'outline'}
              onClick={() => {
                setTypeFilter('PJ');
                setCurrentPage(1);
              }}
              className='h-10'
            >
              <Building2 className='h-4 w-4 mr-2' />
              Pessoa Jurídica
              {typeFilter === 'PJ' && (
                <Badge variant='secondary' className='ml-2'>
                  {clientCounts.PJ}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Tabela de Clientes */}
        {isLoading ? (
          <div className='space-y-3'>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className='h-16 w-full' />
            ))}
          </div>
        ) : filteredClients.length === 0 ? (
          <div className='flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg'>
            <Search className='h-12 w-12 text-gray-400 mb-4' />
            <p className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
              Nenhum cliente encontrado
            </p>
            <p className='text-sm text-muted-foreground mb-4'>
              {searchTerm || typeFilter !== 'ALL'
                ? 'Tente ajustar sua busca ou filtros.'
                : 'Comece cadastrando seu primeiro cliente.'}
            </p>
            {!searchTerm && typeFilter === 'ALL' && (
              <Button onClick={handleCreateClient}>
                <Plus className='h-4 w-4 mr-2' />
                Cadastrar Primeiro Cliente
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-gray-50 dark:bg-gray-800'>
                    <TableHead className='font-semibold'>
                      NOME / RAZÃO SOCIAL
                    </TableHead>
                    <TableHead className='font-semibold'>TIPO</TableHead>
                    <TableHead className='font-semibold'>DOCUMENTO</TableHead>
                    <TableHead className='font-semibold'>
                      CONTATO PRINCIPAL
                    </TableHead>
                    <TableHead className='font-semibold text-right'>
                      AÇÕES
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedClients.map((client) => (
                    <TableRow
                      key={client.id}
                      className='hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    >
                      <TableCell className='font-medium'>
                        {client.legalName && client.type === 'PJ'
                          ? client.legalName
                          : client.name}
                        {client.legalName && client.type === 'PJ' && (
                          <p className='text-xs text-muted-foreground mt-1'>
                            {client.name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={
                            client.type === 'PF'
                              ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20'
                          }
                        >
                          {client.type === 'PF' ? 'PF' : 'PJ'}
                        </Badge>
                      </TableCell>
                      <TableCell className='font-mono text-sm'>
                        {client.type === 'PF'
                          ? maskCPF(client.document)
                          : maskCNPJ(client.document)}
                      </TableCell>
                      <TableCell className='text-sm'>
                        {getMainContact(client)}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center justify-end gap-2'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleViewDetails(client)}
                            className='h-9 w-9 p-0'
                            title='Visualizar detalhes'
                          >
                            <Eye className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleEdit(client)}
                            className='h-9 w-9 p-0'
                            title='Editar cliente'
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleOpenTicket(client)}
                            className='h-9 w-9 p-0'
                            title='Abrir chamado'
                          >
                            <ArrowUpRight className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                Exibindo{' '}
                {filteredClients.length === 0
                  ? '0'
                  : `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
                      currentPage * itemsPerPage,
                      filteredClients.length
                    )}`}{' '}
                de {filteredClients.length}
              </p>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className='h-4 w-4 mr-1' />
                  Anterior
                </Button>
                <div className='flex items-center gap-1'>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={
                          currentPage === pageNum ? 'default' : 'outline'
                        }
                        size='sm'
                        onClick={() => setCurrentPage(pageNum)}
                        className='min-w-[40px]'
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className='h-4 w-4 ml-1' />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Modal de Detalhes do Cliente */}
        <Dialog
          open={!!viewingClient}
          onOpenChange={(open) => !open && setViewingClient(null)}
        >
          <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
            <DialogHeader>
              <DialogTitle className='text-2xl font-semibold'>
                Detalhes do Cliente
              </DialogTitle>
              <DialogDescription>
                Informações completas do cliente
              </DialogDescription>
            </DialogHeader>

            {viewingClient && (
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>
                      Nome / Razão Social
                    </p>
                    <p className='text-base font-semibold'>
                      {viewingClient.legalName && viewingClient.type === 'PJ'
                        ? viewingClient.legalName
                        : viewingClient.name}
                    </p>
                    {viewingClient.legalName && viewingClient.type === 'PJ' && (
                      <p className='text-sm text-muted-foreground mt-1'>
                        Nome Fantasia: {viewingClient.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>
                      Tipo
                    </p>
                    <Badge
                      variant='outline'
                      className={
                        viewingClient.type === 'PF'
                          ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300'
                          : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                      }
                    >
                      {viewingClient.type === 'PF'
                        ? 'Pessoa Física'
                        : 'Pessoa Jurídica'}
                    </Badge>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>
                      Documento
                    </p>
                    <p className='text-base font-mono'>
                      {viewingClient.type === 'PF'
                        ? maskCPF(viewingClient.document)
                        : maskCNPJ(viewingClient.document)}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>
                      Email
                    </p>
                    <p className='text-base'>{viewingClient.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>
                      Telefone
                    </p>
                    <p className='text-base'>
                      {viewingClient.phone
                        ? maskPhone(viewingClient.phone)
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>
                      Cidade / Estado
                    </p>
                    <p className='text-base'>
                      {viewingClient.city && viewingClient.state
                        ? `${viewingClient.city} - ${viewingClient.state}`
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className='flex justify-end gap-3 pt-4 border-t'>
                  <Button
                    variant='outline'
                    onClick={() => setViewingClient(null)}
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={() => {
                      handleEdit(viewingClient);
                      setViewingClient(null);
                    }}
                    className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
                  >
                    <Edit className='h-4 w-4 mr-2' />
                    Editar Cliente
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}