import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  X,
  Save,
  MoreVertical,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface CompanyUser {
  id: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string | null;
  };
  role: 'analyst' | 'financial';
  permissions: Permissions | null;
  createdAt: string;
  updatedAt: string;
}

interface Permissions {
  // Gestão de Chamados
  tickets?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  // Gestão de Clientes
  clients?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  // Agenda
  calendar?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  // Ações Específicas - Analista
  analyst?: {
    openTicketsForClients?: boolean;
    assignTechnicians?: boolean;
    configureServiceOrder?: boolean;
    generateReports?: boolean;
  };
  // Ações Específicas - Financeiro
  financial?: {
    viewReceivables?: boolean;
    processPayments?: boolean;
    manageBankAccounts?: boolean;
    schedulePayments?: boolean;
    receiveSpreadsheets?: boolean;
  };
}

export default function GerenciamentoColaboradoresEmpresa() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState<'analyst' | 'financial'>('analyst');
  const [generatedEmail, setGeneratedEmail] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null
  );
  const [collaboratorToDelete, setCollaboratorToDelete] =
    useState<CompanyUser | null>(null);
  const itemsPerPage = 10;

  // Buscar colaboradores da empresa
  const { data: collaborators, isLoading } = useQuery<CompanyUser[]>({
    queryKey: ['/api/company/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/company/users', undefined);
      if (!response.ok) {
        throw new Error('Erro ao carregar colaboradores');
      }
      return response.json();
    },
  });

  // Filtrar colaboradores
  const filteredCollaborators = useMemo(() => {
    if (!collaborators) return [];

    return collaborators.filter((collab) => {
      const fullName =
        `${collab.user.firstName} ${collab.user.lastName}`.toLowerCase();
      const email = collab.user.email.toLowerCase();
      return (
        fullName.includes(searchTerm.toLowerCase()) ||
        email.includes(searchTerm.toLowerCase())
      );
    });
  }, [collaborators, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredCollaborators.length / itemsPerPage);
  const paginatedCollaborators = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCollaborators.slice(startIndex, endIndex);
  }, [filteredCollaborators, currentPage]);

  // Mutation para atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async (data: { userId: string; permissions: Permissions }) => {
      const response = await apiRequest(
        'PUT',
        `/api/company/users/${data.userId}/permissions`,
        data.permissions
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao atualizar permissões');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company/users'] });
      toast({
        title: 'Permissões atualizadas',
        description:
          'As permissões do colaborador foram atualizadas com sucesso.',
      });
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar permissões',
        description: error.message,
      });
    },
  });

  const handleEditPermissions = (user: CompanyUser) => {
    setEditingUser(user);
    // Inicializar permissões com valores padrão ou existentes
    setPermissions(
      user.permissions || {
        tickets: { create: false, read: false, update: false, delete: false },
        clients: { create: false, read: false, update: false, delete: false },
        calendar: { create: false, read: false, update: false, delete: false },
        ...(user.role === 'analyst'
          ? {
              analyst: {
                openTicketsForClients: false,
                assignTechnicians: false,
                configureServiceOrder: false,
                generateReports: false,
              },
            }
          : {
              financial: {
                viewReceivables: false,
                processPayments: false,
                manageBankAccounts: false,
                schedulePayments: false,
                receiveSpreadsheets: false,
              },
            }),
      }
    );
  };

  const handleSavePermissions = () => {
    if (!editingUser) return;
    updatePermissionsMutation.mutate({
      userId: editingUser.userId,
      permissions,
    });
  };

  const addCollaboratorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/collaborators', {
        firstName: newFirstName,
        lastName: newLastName,
        role: newRole,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erro ao criar colaborador');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setGeneratedEmail(data.email);
      setGeneratedPassword(data.tempPassword);
      queryClient.invalidateQueries({ queryKey: ['/api/company/users'] });
      toast({
        title: 'Colaborador criado',
        description:
          'Compartilhe o email e a senha temporária com o colaborador.',
      });
      // Não fechar o diálogo imediatamente para mostrar email/senha
      // Usuário pode fechar manualmente ou criar outro
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar colaborador',
        description: error.message,
      });
    },
  });

  const handleDelete = (user: CompanyUser) => {
    setCollaboratorToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!collaboratorToDelete) return;
    const user = collaboratorToDelete;
    setCollaboratorToDelete(null);

    try {
      const response = await apiRequest(
        'DELETE',
        `/api/company/users/${user.id}`,
        undefined
      );
      if (!response.ok) {
        throw new Error('Erro ao remover colaborador');
      }
      queryClient.invalidateQueries({ queryKey: ['/api/company/users'] });
      toast({
        title: 'Colaborador removido',
        description: 'O colaborador foi removido com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover colaborador',
        description: error.message,
      });
    }
  };

  const getRoleLabel = (role: string) => {
    return role === 'analyst' ? 'Analista' : 'Financeiro';
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'analyst'
      ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20'
      : 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20';
  };

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
            Gerenciamento de Colaboradores
          </h1>
          <p className='text-muted-foreground mt-1'>
            Gerencie os colaboradores da sua empresa e suas permissões
          </p>
        </div>
        <Button
          onClick={() => {
            setShowAddDialog(true);
            setGeneratedEmail(null);
            setGeneratedPassword(null);
            setNewFirstName('');
            setNewLastName('');
            setNewRole('analyst');
          }}
          className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
        >
          <Plus className='h-4 w-4 mr-2' />
          // Adicionar Colaborador
        </Button>
      </div>

      {/* Busca */}
      <div className='relative'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
        <Input
          placeholder='Buscar por nome ou email...'
          className='pl-10 h-12'
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Tabela de Colaboradores */}
      {isLoading ? (
        <div className='space-y-3'>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className='h-16 w-full' />
          ))}
        </div>
      ) : filteredCollaborators.length === 0 ? (
        <div className='flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg'>
          <User className='h-12 w-12 text-gray-400 mb-4' />
          <p className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
            Nenhum colaborador encontrado
          </p>
          <p className='text-sm text-muted-foreground mb-4'>
            {searchTerm
              ? 'Tente ajustar sua busca.'
              : 'Comece adicionando seu primeiro colaborador.'}
          </p>
          {!searchTerm && (
            <Button
              onClick={() => {
                setShowAddDialog(true);
                setGeneratedEmail(null);
                setGeneratedPassword(null);
                setNewFirstName('');
                setNewLastName('');
                setNewRole('analyst');
              }}
            >
              <Plus className='h-4 w-4 mr-2' />
              // Adicionar Primeiro Colaborador
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow className='bg-gray-50 dark:bg-gray-800'>
                  <TableHead className='font-semibold'>NOME</TableHead>
                  <TableHead className='font-semibold'>EMAIL</TableHead>
                  <TableHead className='font-semibold'>CARGO</TableHead>
                  <TableHead className='font-semibold'>
                    DATA DE ADIÇÃO
                  </TableHead>
                  <TableHead className='font-semibold text-right'>
                    AÇÕES
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCollaborators.map((collab) => (
                  <TableRow
                    key={collab.id}
                    className='hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  >
                    <TableCell className='font-medium'>
                      <div className='flex items-center gap-3'>
                        {collab.user.profileImageUrl ? (
                          <img
                            src={collab.user.profileImageUrl}
                            alt={`${collab.user.firstName} ${collab.user.lastName}`}
                            className='h-10 w-10 rounded-full object-cover'
                          />
                        ) : (
                          <div className='h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center'>
                            <User className='h-5 w-5 text-gray-500' />
                          </div>
                        )}
                        <div>
                          <p className='font-semibold'>
                            {collab.user.firstName} {collab.user.lastName}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {collab.user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant='outline'
                        className={getRoleBadgeColor(collab.role)}
                      >
                        {getRoleLabel(collab.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {new Date(collab.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center justify-end'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-9 w-9 p-0'
                              title='Ações'
                            >
                              <MoreVertical className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => handleEditPermissions(collab)}
                              className='cursor-pointer'
                            >
                              <Edit className='h-4 w-4 mr-2' />
                              Editar Acessos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(collab)}
                              className='cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20'
                            >
                              <Trash2 className='h-4 w-4 mr-2' />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
              {filteredCollaborators.length === 0
                ? '0'
                : `${(currentPage - 1) * itemsPerPage + 1}-${Math.min(
                    currentPage * itemsPerPage,
                    filteredCollaborators.length
                  )}`}{' '}
              de {filteredCollaborators.length}
            </p>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                      variant={currentPage === pageNum ? 'default' : 'outline'}
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

      {/* Modal de Editar Acessos */}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='text-2xl font-semibold'>
              Editar Acessos: {editingUser?.user.firstName}{' '}
              {editingUser?.user.lastName}
            </DialogTitle>
            <DialogDescription>
              Cargo: {editingUser && getRoleLabel(editingUser.role)}
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className='space-y-6'>
              {/* Gestão de Chamados */}
              <Card className='border border-gray-200 dark:border-gray-700'>
                <CardContent className='p-4'>
                  <h3 className='text-lg font-semibold mb-4'>
                    Gestão de Chamados
                  </h3>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='tickets-create'
                        checked={permissions.tickets?.create || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            tickets: {
                              ...permissions.tickets,
                              create: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='tickets-create'
                        className='cursor-pointer'
                      >
                        Criar
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='tickets-read'
                        checked={permissions.tickets?.read || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            tickets: {
                              ...permissions.tickets,
                              read: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label htmlFor='tickets-read' className='cursor-pointer'>
                        Ler
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='tickets-update'
                        checked={permissions.tickets?.update || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            tickets: {
                              ...permissions.tickets,
                              update: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='tickets-update'
                        className='cursor-pointer'
                      >
                        Atualizar
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='tickets-delete'
                        checked={permissions.tickets?.delete || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            tickets: {
                              ...permissions.tickets,
                              delete: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='tickets-delete'
                        className='cursor-pointer'
                      >
                        Deletar
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gestão de Clientes */}
              <Card className='border border-gray-200 dark:border-gray-700'>
                <CardContent className='p-4'>
                  <h3 className='text-lg font-semibold mb-4'>
                    Gestão de Clientes
                  </h3>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='clients-create'
                        checked={permissions.clients?.create || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            clients: {
                              ...permissions.clients,
                              create: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='clients-create'
                        className='cursor-pointer'
                      >
                        Criar
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='clients-read'
                        checked={permissions.clients?.read || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            clients: {
                              ...permissions.clients,
                              read: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label htmlFor='clients-read' className='cursor-pointer'>
                        Ler
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='clients-update'
                        checked={permissions.clients?.update || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            clients: {
                              ...permissions.clients,
                              update: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='clients-update'
                        className='cursor-pointer'
                      >
                        Atualizar
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='clients-delete'
                        checked={permissions.clients?.delete || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            clients: {
                              ...permissions.clients,
                              delete: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='clients-delete'
                        className='cursor-pointer'
                      >
                        Deletar
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agenda */}
              <Card className='border border-gray-200 dark:border-gray-700'>
                <CardContent className='p-4'>
                  <h3 className='text-lg font-semibold mb-4'>Agenda</h3>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='calendar-create'
                        checked={permissions.calendar?.create || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            calendar: {
                              ...permissions.calendar,
                              create: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='calendar-create'
                        className='cursor-pointer'
                      >
                        Criar
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='calendar-read'
                        checked={permissions.calendar?.read || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            calendar: {
                              ...permissions.calendar,
                              read: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label htmlFor='calendar-read' className='cursor-pointer'>
                        Ler
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='calendar-update'
                        checked={permissions.calendar?.update || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            calendar: {
                              ...permissions.calendar,
                              update: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='calendar-update'
                        className='cursor-pointer'
                      >
                        Atualizar
                      </Label>
                    </div>
                    <div className='flex items-center space-x-2'>
                      <Checkbox
                        id='calendar-delete'
                        checked={permissions.calendar?.delete || false}
                        onCheckedChange={(checked) =>
                          setPermissions({
                            ...permissions,
                            calendar: {
                              ...permissions.calendar,
                              delete: checked as boolean,
                            },
                          })
                        }
                      />
                      <Label
                        htmlFor='calendar-delete'
                        className='cursor-pointer'
                      >
                        Deletar
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ações Específicas */}
              <Card className='border border-gray-200 dark:border-gray-700'>
                <CardContent className='p-4'>
                  <h3 className='text-lg font-semibold mb-4'>
                    Ações Específicas ({getRoleLabel(editingUser.role)})
                  </h3>
                  {editingUser.role === 'analyst' ? (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='analyst-open-tickets'
                          checked={
                            permissions.analyst?.openTicketsForClients || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              analyst: {
                                ...permissions.analyst,
                                openTicketsForClients: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='analyst-open-tickets'
                          className='cursor-pointer'
                        >
                          Abrir Chamados para Clientes
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='analyst-assign'
                          checked={
                            permissions.analyst?.assignTechnicians || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              analyst: {
                                ...permissions.analyst,
                                assignTechnicians: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='analyst-assign'
                          className='cursor-pointer'
                        >
                          Atribuir Técnicos aos Chamados
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='analyst-service-order'
                          checked={
                            permissions.analyst?.configureServiceOrder || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              analyst: {
                                ...permissions.analyst,
                                configureServiceOrder: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='analyst-service-order'
                          className='cursor-pointer'
                        >
                          Configurar Ordem de Serviço (OS)
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='analyst-reports'
                          checked={
                            permissions.analyst?.generateReports || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              analyst: {
                                ...permissions.analyst,
                                generateReports: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='analyst-reports'
                          className='cursor-pointer'
                        >
                          Gerar Relatórios de Atendimento
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='financial-receivables'
                          checked={
                            permissions.financial?.viewReceivables || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              financial: {
                                ...permissions.financial,
                                viewReceivables: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='financial-receivables'
                          className='cursor-pointer'
                        >
                          Visualizar Valores a Receber
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='financial-payments'
                          checked={
                            permissions.financial?.processPayments || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              financial: {
                                ...permissions.financial,
                                processPayments: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='financial-payments'
                          className='cursor-pointer'
                        >
                          Efetuar Pagamentos via API
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='financial-bank'
                          checked={
                            permissions.financial?.manageBankAccounts || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              financial: {
                                ...permissions.financial,
                                manageBankAccounts: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='financial-bank'
                          className='cursor-pointer'
                        >
                          Gerenciar Cadastro Bancário
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='financial-schedule'
                          checked={
                            permissions.financial?.schedulePayments || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              financial: {
                                ...permissions.financial,
                                schedulePayments: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='financial-schedule'
                          className='cursor-pointer'
                        >
                          Agendar Pagamentos
                        </Label>
                      </div>
                      <div className='flex items-center space-x-2'>
                        <Checkbox
                          id='financial-spreadsheets'
                          checked={
                            permissions.financial?.receiveSpreadsheets || false
                          }
                          onCheckedChange={(checked) =>
                            setPermissions({
                              ...permissions,
                              financial: {
                                ...permissions.financial,
                                receiveSpreadsheets: checked as boolean,
                              },
                            })
                          }
                        />
                        <Label
                          htmlFor='financial-spreadsheets'
                          className='cursor-pointer'
                        >
                          Receber Planilhas dos Técnicos
                        </Label>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Botões de Ação */}
              <div className='flex justify-end gap-3 pt-4 border-t'>
                <Button variant='outline' onClick={() => setEditingUser(null)}>
                  <X className='h-4 w-4 mr-2' />
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePermissions}
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
                  disabled={updatePermissionsMutation.isPending}
                >
                  <Save className='h-4 w-4 mr-2' />
                  {updatePermissionsMutation.isPending
                    ? 'Salvando...'
                    : 'Salvar Alterações'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de novo colaborador */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Adicionar colaborador</DialogTitle>
            <DialogDescription>
              Informe apenas o nome completo e o cargo. O sistema gerará o email
              usando o email principal da empresa e criará uma senha temporária.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 mt-2'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <div>
                <Label className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                  Nome
                </Label>
                <Input
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder='João'
                />
              </div>
              <div>
                <Label className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                  Sobrenome
                </Label>
                <Input
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder='Silva'
                />
              </div>
            </div>

            <div>
              <Label className='text-sm font-medium text-gray-700 dark:text-gray-200'>
                Cargo
              </Label>
              <RadioGroup
                value={newRole}
                onValueChange={(v) =>
                  setNewRole((v as 'analyst' | 'financial') || 'analyst')
                }
                className='flex gap-4 mt-2'
              >
                <label className='flex items-center gap-2 text-sm'>
                  <RadioGroupItem value='analyst' />
                  Analista
                </label>
                <label className='flex items-center gap-2 text-sm'>
                  <RadioGroupItem value='financial' />
                  Financeiro
                </label>
              </RadioGroup>
            </div>

            {generatedEmail && (
              <Card className='bg-green-50 border-green-200 text-green-900'>
                <CardContent className='p-3 space-y-1 text-sm'>
                  <p>
                    <strong>Email gerado:</strong> {generatedEmail}
                  </p>
                  {generatedPassword && (
                    <p>
                      <strong>Senha temporária:</strong> {generatedPassword}
                    </p>
                  )}
                  <p className='text-xs text-green-800'>
                    Compartilhe este email e senha com o colaborador. Ele poderá
                    trocar a senha em Perfil.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className='flex justify-end gap-2 mt-4'>
            {generatedEmail ? (
              <>
                <Button
                  variant='outline'
                  onClick={() => {
                    setShowAddDialog(false);
                    setNewFirstName('');
                    setNewLastName('');
                    setNewRole('analyst');
                    setGeneratedEmail(null);
                    setGeneratedPassword(null);
                  }}
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    setNewFirstName('');
                    setNewLastName('');
                    setNewRole('analyst');
                    setGeneratedEmail(null);
                    setGeneratedPassword(null);
                  }}
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
                >
                  Criar Outro
                </Button>
              </>
            ) : (
              <>
                <Button variant='outline' onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => addCollaboratorMutation.mutate()}
                  disabled={
                    addCollaboratorMutation.isPending ||
                    !newFirstName.trim() ||
                    !newLastName.trim()
                  }
                  className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
                >
                  {addCollaboratorMutation.isPending ? 'Criando...' : 'Criar'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!collaboratorToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setCollaboratorToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{' '}
              {collaboratorToDelete
                ? `${collaboratorToDelete.user.firstName} ${collaboratorToDelete.user.lastName}`
                : 'este colaborador'}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCollaboratorToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}