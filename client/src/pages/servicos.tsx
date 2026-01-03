import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Clock,
  DollarSign,
  Edit,
  ImagePlus,
  Info,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string;
  duration: number;
  active: boolean;
  publicBooking: boolean;
  warranty?: string | null;
  imageUrl?: string | null;
  billingUnit?: string | null;
}

const billingUnitOptions = [
  { value: 'por_hora', label: 'Por hora' },
  { value: 'por_visita', label: 'Por visita' },
  { value: 'por_item', label: 'Por item' },
  { value: 'por_equipamento', label: 'Por equipamento' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'pacote', label: 'Pacote/Projeto' },
];

const getBillingUnitLabel = (value?: string | null) => {
  if (!value) return '';
  return billingUnitOptions.find((option) => option.value === value)?.label ?? value;
};

const formatCurrency = (value: string | number) => {
  const numeric = Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return 'R$ 0,00';
  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatDuration = (hours: number) => {
  const safeHours = Number.isFinite(hours) ? hours : 0;
  const h = Math.floor(safeHours);
  const m = Math.round((safeHours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h}h ${m}min`;
};

export default function Servicos() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deletingService, setDeletingService] = useState<Service | null>(null);

  const [searchName, setSearchName] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const filteredServices = useMemo(() => {
    if (!services) return [];

    return services.filter((service) => {
      const matchesName =
        searchName === '' ||
        service.name.toLowerCase().includes(searchName.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && service.active) ||
        (statusFilter === 'inactive' && !service.active);

      return matchesName && matchesStatus;
    });
  }, [services, searchName, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/services/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      setDeletingService(null);
      toast({
        title: 'Serviço excluído',
        description: 'O serviço foi removido com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir serviço',
        description: error.message,
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      return await apiRequest('PATCH', `/api/services/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({
        title: 'Status alterado',
        description: 'O status do serviço foi atualizado.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar status',
        description: error.message,
      });
    },
  });

  const handleCreate = () => {
    setLocation('/edicao-servico/novo');
  };

  const handleDelete = async () => {
    if (deletingService) {
      await deleteMutation.mutateAsync(deletingService.id);
    }
  };

  const handleToggleActive = async (service: Service) => {
    await toggleActiveMutation.mutateAsync({
      id: service.id,
      active: !service.active,
    });
  };

  return (
    <div className='space-y-6'>
      <PageHeader>
        <div className='flex flex-wrap justify-between items-center gap-4'>
        <h1
          className='text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'
          data-testid='text-page-title'
        >
          Listagem de Serviços
        </h1>
        <Button
          onClick={handleCreate}
          data-testid='button-new-service'
          className='flex min-w-[84px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-[#3880f5] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#3880f5]/90'
        >
          <Plus className='h-4 w-4' />
          <span className='truncate'>Novo Serviço</span>
        </Button>
        </div>
      </PageHeader>

      <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
          <Input
            type='text'
            placeholder='Buscar por nome...'
            value={searchName}
            onChange={(event) => setSearchName(event.target.value)}
            className='pl-10 pr-10 h-10'
          />
          {searchName && (
            <button
              onClick={() => setSearchName('')}
              className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
            >
              <X className='h-4 w-4' />
            </button>
          )}
        </div>

        <div className='flex gap-2'>
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className='h-10'
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('active')}
            className='h-10'
          >
            Ativo
          </Button>
          <Button
            variant={statusFilter === 'inactive' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('inactive')}
            className='h-10'
          >
            Inativo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className='p-5 space-y-4'>
              <Skeleton className='h-32 w-full rounded-lg' />
              <div className='space-y-2'>
                <Skeleton className='h-5 w-3/4' />
                <Skeleton className='h-4 w-1/2' />
              </div>
              <Skeleton className='h-10 w-full' />
            </Card>
          ))}
        </div>
      ) : !filteredServices || filteredServices.length === 0 ? (
        <div className='mt-10 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 p-12 text-center bg-gray-50 dark:bg-gray-900'>
          <div className='flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 mb-4'>
            <X className='h-8 w-8 text-gray-400' />
          </div>
          <h3 className='mt-4 text-lg font-medium text-gray-900 dark:text-white'>
            Nenhum serviço encontrado
          </h3>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
            Tente ajustar seus filtros ou adicione um novo serviço.
          </p>
          <Button onClick={handleCreate} className='mt-4'>
            <Plus className='w-4 h-4 mr-2' />
            Adicionar Novo Serviço
          </Button>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {filteredServices.map((service) => (
            <Card
              key={service.id}
              className='flex flex-col justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md transition-all'
              data-testid={`card-service-${service.id}`}
            >
              <div className='space-y-4'>
                <div className='relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900'>
                  <div className='aspect-[4/3]'>
                    {service.imageUrl ? (
                      <img
                        src={service.imageUrl}
                        alt={`Imagem de ${service.name}`}
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <div className='flex h-full w-full items-center justify-center text-gray-400'>
                        <ImagePlus className='h-5 w-5' />
                      </div>
                    )}
                  </div>
                  {service.publicBooking && (
                    <span className='absolute right-3 top-3 rounded-full bg-white/90 dark:bg-gray-900/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200'>
                      Público
                    </span>
                  )}
                </div>

                <div>
                  <div className='flex items-start justify-between mb-2 gap-2'>
                    <h3
                      className='text-lg font-bold text-gray-900 dark:text-white flex-1'
                      data-testid={`text-service-name-${service.id}`}
                    >
                      {service.name}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        service.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                      }`}
                    >
                      {service.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {service.description && (
                    <p
                      className='text-sm text-gray-600 dark:text-gray-400 line-clamp-2'
                      data-testid={`text-service-description-${service.id}`}
                    >
                      {service.description}
                    </p>
                  )}
                </div>

                {service.warranty && (
                  <div className='flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400'>
                    {service.warranty && (
                      <span className='inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-1'>
                        <ShieldCheck className='h-3 w-3' />
                        Garantia {service.warranty}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between'>
                <div className='flex flex-wrap items-center gap-1'>
                  <DollarSign className='h-4 w-4 text-gray-500 dark:text-gray-400' />
                  <span
                    className='text-sm font-semibold text-gray-900 dark:text-white'
                    data-testid={`text-service-price-${service.id}`}
                  >
                    {formatCurrency(service.price)}
                  </span>
                  {service.billingUnit && (
                    <span className='text-xs text-muted-foreground'>
                      / {getBillingUnitLabel(service.billingUnit)}
                    </span>
                  )}
                </div>
                <div className='flex items-center gap-1'>
                  <Clock className='h-4 w-4 text-gray-500 dark:text-gray-400' />
                  <span
                    className='text-sm text-gray-600 dark:text-gray-400'
                    data-testid={`text-service-duration-${service.id}`}
                  >
                    {formatDuration(service.duration)}
                  </span>
                </div>
              </div>

              <div className='mt-4 flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setLocation(`/edicao-servico/${service.id}`)}
                  data-testid={`button-edit-${service.id}`}
                  className='flex-1 h-9 text-sm'
                >
                  <Edit className='w-4 h-4 mr-2' />
                  Editar
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => handleToggleActive(service)}
                  data-testid={`button-toggle-active-${service.id}`}
                  title={service.active ? 'Desativar serviço' : 'Ativar serviço'}
                  className='h-9 w-9 p-0'
                >
                  <Power
                    className={`w-4 h-4 ${
                      service.active ? 'text-green-500' : 'text-gray-400'
                    }`}
                  />
                </Button>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => setDeletingService(service)}
                  data-testid={`button-delete-${service.id}`}
                  className='h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'
                >
                  <Trash2 className='w-4 h-4' />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deletingService}
        onOpenChange={(open) => !open && setDeletingService(null)}
      >
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight'>
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
              Tem certeza que deseja excluir o serviço "
              {deletingService?.name ?? ''}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-4 pt-4 border-t dark:border-gray-700'>
            <AlertDialogCancel
              data-testid='button-cancel-delete'
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-red-600 text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
              data-testid='button-confirm-delete'
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
