import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Home, Wrench } from 'lucide-react';
import { Link } from 'wouter';
import { maskCurrency } from '@/lib/masks';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
  publicScheduling: boolean;
}

export default function EdicaoServico2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const serviceId = window.location.pathname.split('/').pop() || '';
  const isEdit = !!serviceId && serviceId !== 'novo';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    active: true,
    publicScheduling: false,
  });

  const { data: service } = useQuery<Service>({
    queryKey: ['/api/services', serviceId],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/services/${serviceId}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviço');
      return response.json();
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        description: service.description,
        price: service.price.toString(),
        duration: service.duration.toString(),
        active: service.active,
        publicScheduling: service.publicScheduling,
      });
    }
  }, [service]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        price: parseFloat(data.price.replace(/[^\d,]/g, '').replace(',', '.')),
        duration: parseFloat(data.duration),
      };
      const response = isEdit
        ? await apiRequest('PUT', `/api/services/${serviceId}`, payload)
        : await apiRequest('POST', '/api/services', payload);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar serviço');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({
        title: isEdit ? 'Serviço atualizado' : 'Serviço criado',
        description: `O serviço foi ${
          isEdit ? 'atualizado' : 'criado'
        } com sucesso.`,
      });
      setLocation('/servicos');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar serviço',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className='font-display bg-background-light dark:bg-background-dark'>
      <div className='relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden'>
        <div className='flex h-full grow'>
          {/* SideNavBar */}
          <aside className='flex-shrink-0 w-64 bg-white dark:bg-background-dark dark:border-r dark:border-slate-800 hidden lg:flex flex-col justify-between p-4'>
            <div className='flex flex-col gap-4'>
              <div className='flex gap-3 items-center'>
                <div className='bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20'></div>
                <div className='flex flex-col'>
                  <h1 className='text-[#111418] dark:text-white text-base font-medium leading-normal'>
                    ChamadosPro
                  </h1>
                  <p className='text-[#60708a] dark:text-slate-400 text-sm font-normal leading-normal'>
                    Técnico de TI
                  </p>
                </div>
              </div>
              <nav className='flex flex-col gap-2'>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-[#111418] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg'
                  href='#'
                >
                  <span className='text-2xl'>📊</span>
                  <p className='text-sm font-medium leading-normal'>
                    Dashboard
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-[#111418] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg'
                  href='#'
                >
                  <span className='text-2xl'>👥</span>
                  <p className='text-sm font-medium leading-normal'>Clientes</p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-[#111418] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg'
                  href='#'
                >
                  <span className='text-2xl'>🎫</span>
                  <p className='text-sm font-medium leading-normal'>Chamados</p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-white'
                  href='#'
                >
                  <Wrench className='w-6 h-6' />
                  <p className='text-sm font-medium leading-normal'>Serviços</p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-[#111418] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg'
                  href='#'
                >
                  <span className='text-2xl'>💰</span>
                  <p className='text-sm font-medium leading-normal'>
                    Financeiro
                  </p>
                </a>
              </nav>
            </div>
            <div className='flex flex-col gap-4'>
              <Button
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
                onClick={() => setLocation('/criacao-chamado')}
              >
                <span className='truncate'>Novo Chamado</span>
              </Button>
              <div className='flex flex-col gap-1'>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-[#111418] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg'
                  href='#'
                >
                  <span className='text-2xl'>⚙️</span>
                  <p className='text-sm font-medium leading-normal'>
                    Configurações
                  </p>
                </a>
                <a
                  className='flex items-center gap-3 px-3 py-2 text-[#111418] dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg'
                  href='#'
                >
                  <span className='text-2xl'>🚪</span>
                  <p className='text-sm font-medium leading-normal'>Sair</p>
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className='flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto'>
            <div className='max-w-4xl mx-auto'>
              {/* Breadcrumbs */}
              <div className='flex flex-wrap gap-2 mb-4'>
                <Link
                  href='/'
                  className='text-[#60708a] dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary dark:hover:text-primary'
                >
                  Início
                </Link>
                <span className='text-[#60708a] dark:text-slate-400 text-sm font-medium leading-normal'>
                  /
                </span>
                <Link
                  href='/servicos'
                  className='text-[#60708a] dark:text-slate-400 text-sm font-medium leading-normal hover:text-primary dark:hover:text-primary'
                >
                  Serviços
                </Link>
                <span className='text-[#60708a] dark:text-slate-400 text-sm font-medium leading-normal'>
                  /
                </span>
                <span className='text-[#111418] dark:text-white text-sm font-medium leading-normal'>
                  {isEdit ? 'Editar Serviço' : 'Cadastrar Serviço'}
                </span>
              </div>

              {/* PageHeading */}
              <div className='flex flex-wrap justify-between gap-3 mb-8'>
                <h1 className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em] min-w-72'>
                  {isEdit ? 'Editar Serviço' : 'Cadastrar Serviço'}
                </h1>
              </div>

              {/* Form Container */}
              <Card className='bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 md:p-8'>
                <form onSubmit={handleSubmit} className='space-y-6'>
                  {/* Nome do serviço */}
                  <div className='flex flex-col'>
                    <Label
                      className='text-[#111418] dark:text-slate-200 text-base font-medium leading-normal pb-2'
                      htmlFor='service-name'
                    >
                      Nome do serviço
                    </Label>
                    <Input
                      className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white dark:bg-slate-800 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-slate-700 bg-white focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal'
                      id='service-name'
                      name='service-name'
                      placeholder='Ex: Formatação de Computador com Backup'
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  {/* Descrição */}
                  <div className='flex flex-col'>
                    <Label
                      className='text-[#111418] dark:text-slate-200 text-base font-medium leading-normal pb-2'
                      htmlFor='service-description'
                    >
                      Descrição
                    </Label>
                    <Textarea
                      className='flex w-full min-w-0 flex-1 resize-y overflow-hidden rounded-lg text-[#111418] dark:text-white dark:bg-slate-800 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-slate-700 bg-white focus:border-primary dark:focus:border-primary min-h-36 placeholder:text-[#60708a] dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal'
                      id='service-description'
                      name='service-description'
                      placeholder='Descreva o serviço em detalhes, incluindo o que está incluso e o que não está.'
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Grid for Price and Duration */}
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {/* Preço */}
                    <div className='flex flex-col'>
                      <Label
                        className='text-[#111418] dark:text-slate-200 text-base font-medium leading-normal pb-2'
                        htmlFor='service-price'
                      >
                        Preço
                      </Label>
                      <div className='relative'>
                        <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4'>
                          <span className='text-[#60708a] dark:text-slate-400'>
                            R$
                          </span>
                        </div>
                        <Input
                          className='pl-10 flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white dark:bg-slate-800 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-slate-700 bg-white focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal'
                          id='service-price'
                          name='service-price'
                          placeholder='150,00'
                          value={formData.price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              price: maskCurrency(e.target.value),
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Duração (em horas) */}
                    <div className='flex flex-col'>
                      <Label
                        className='text-[#111418] dark:text-slate-200 text-base font-medium leading-normal pb-2'
                        htmlFor='service-duration'
                      >
                        Duração (em horas)
                      </Label>
                      <Input
                        type='number'
                        min='0'
                        step='0.5'
                        className='flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#111418] dark:text-white dark:bg-slate-800 focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-[#dbdfe6] dark:border-slate-700 bg-white focus:border-primary dark:focus:border-primary h-14 placeholder:text-[#60708a] dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal'
                        id='service-duration'
                        name='service-duration'
                        placeholder='Ex: 2.5'
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData({ ...formData, duration: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className='space-y-4 pt-2'>
                    <div className='relative flex items-center'>
                      <Checkbox
                        id='service-active'
                        checked={formData.active}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            active: checked as boolean,
                          })
                        }
                        className='h-5 w-5 rounded border-[#dbdfe6] dark:border-slate-700 text-primary focus:ring-primary dark:bg-slate-800 dark:checked:bg-primary'
                      />
                      <Label
                        className='ml-3 block text-base font-medium text-[#111418] dark:text-slate-200'
                        htmlFor='service-active'
                      >
                        Serviço Ativo
                      </Label>
                    </div>
                    <div className='relative flex items-center'>
                      <Checkbox
                        id='public-scheduling'
                        checked={formData.publicScheduling}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            publicScheduling: checked as boolean,
                          })
                        }
                        className='h-5 w-5 rounded border-[#dbdfe6] dark:border-slate-700 text-primary focus:ring-primary dark:bg-slate-800 dark:checked:bg-primary'
                      />
                      <Label
                        className='ml-3 block text-base font-medium text-[#111418] dark:text-slate-200'
                        htmlFor='public-scheduling'
                      >
                        Aparecer no Agendamento Público
                      </Label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className='flex items-center justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-800'>
                    <Button
                      type='button'
                      variant='outline'
                      className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-slate-200/80 dark:bg-slate-700/80 text-[#111418] dark:text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-slate-200 dark:hover:bg-slate-700'
                      onClick={() => setLocation('/servicos')}
                    >
                      <span className='truncate'>Cancelar</span>
                    </Button>
                    <Button
                      type='submit'
                      className='flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-primary/90'
                      disabled={saveMutation.isPending}
                    >
                      <span className='truncate'>
                        {saveMutation.isPending
                          ? 'Salvando...'
                          : 'Salvar Serviço'}
                      </span>
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
























