import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { Clock, DollarSign } from 'lucide-react';
import { maskCurrency } from '@/lib/masks';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  active: boolean;
}

export default function ServicosAgendamentoPublico2() {
  const [, setLocation] = useLocation();
  const publicSlug = window.location.pathname.split('/')[1] || '';

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['/api/public/services', publicSlug],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `/api/public/services-by-slug/${publicSlug}`,
        undefined
      );
      if (!response.ok) throw new Error('Erro ao carregar serviços');
      return response.json();
    },
    enabled: !!publicSlug,
  });

  const activeServices = services?.filter((s) => s.active) || [];

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `Aprox. ${m} min`;
    if (m === 0) return `Aprox. ${h} h`;
    return `Aprox. ${h}h ${m}min`;
  };

  return (
    <div className='font-display bg-background-light dark:bg-background-dark text-[#111418] dark:text-gray-200'>
      <div className='relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden'>
        <div className='layout-container flex h-full grow flex-col'>
          <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#f0f2f5] dark:border-b-gray-800 px-4 sm:px-10 py-3 bg-white dark:bg-background-dark'>
            <div className='flex items-center gap-4 text-primary'>
              <div className='size-6'>
                <svg
                  fill='currentColor'
                  viewBox='0 0 48 48'
                  xmlns='http://www.w3.org/2000/svg'
                >
                  <path d='M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z'></path>
                </svg>
              </div>
              <h2 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]'>
                ChamadosPro
              </h2>
            </div>
            <div className='flex flex-1 justify-end'>
              <Button
                className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors'
                onClick={() => {
                  window.location.href = '/login';
                }}
              >
                <span className='truncate'>Login do Técnico</span>
              </Button>
            </div>
          </header>
          <main className='flex flex-1 justify-center py-5 px-4 sm:px-10 md:px-20 lg:px-40'>
            <div className='layout-content-container flex flex-col max-w-5xl flex-1'>
              <div className='flex flex-wrap justify-between gap-4 p-4'>
                <div className='flex min-w-72 flex-col gap-3'>
                  <p className='text-[#111418] dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
                    Serviços Disponíveis para Agendamento
                  </p>
                  <p className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
                    Escolha o serviço que você precisa e agende um horário com
                    nossos técnicos especializados.
                  </p>
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4'>
                {isLoading ? (
                  <div className='col-span-full text-center py-12 text-gray-400'>
                    Carregando...
                  </div>
                ) : activeServices.length > 0 ? (
                  activeServices.map((service) => (
                    <Card
                      key={service.id}
                      className='flex flex-col gap-4 p-5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm'
                    >
                      <div>
                        <h3 className='text-[#111418] dark:text-white text-lg font-bold leading-normal'>
                          {service.name}
                        </h3>
                        <p className='text-[#60708a] dark:text-gray-400 text-sm font-normal leading-normal mt-1'>
                          {service.description}
                        </p>
                      </div>
                      <div className='flex flex-col gap-2 text-sm text-[#60708a] dark:text-gray-400'>
                        <div className='flex items-center gap-2'>
                          <Clock className='w-4 h-4' />
                          <span>
                            Duração: {formatDuration(service.duration)}
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <DollarSign className='w-4 h-4' />
                          <span>
                            Preço: {maskCurrency(service.price.toString())}
                          </span>
                        </div>
                      </div>
                      <Button
                        className='flex w-full mt-2 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-primary/90 transition-colors'
                        onClick={() =>
                          setLocation(`/${publicSlug}/service/${service.id}`)
                        }
                      >
                        <span className='truncate'>Agendar Agora</span>
                      </Button>
                    </Card>
                  ))
                ) : (
                  <div className='col-span-full text-center py-12 text-gray-400'>
                    Nenhum serviço disponível
                  </div>
                )}
              </div>
              <div className='p-4 mt-8'>
                <Card className='bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-800'>
                  <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] pb-3'>
                    Política de Cancelamento
                  </h2>
                  <p className='text-[#60708a] dark:text-gray-400 text-sm font-normal leading-relaxed'>
                    Entendemos que imprevistos acontecem. Você pode cancelar ou
                    reagendar seu serviço com até 24 horas de antecedência sem
                    nenhum custo. Cancelamentos realizados com menos de 24 horas
                    de antecedência estarão sujeitos a uma taxa de 50% do valor
                    do serviço agendado. Em caso de não comparecimento sem aviso
                    prévio, o valor total do serviço será cobrado. Agradecemos a
                    sua compreensão.
                  </p>
                </Card>
              </div>
              <div className='p-4 mt-4'>
                <Card className='bg-white dark:bg-gray-900/50 p-6 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col items-center gap-4'>
                  <h2 className='text-[#111418] dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em]'>
                    Verificação de Segurança
                  </h2>
                  <div className='flex items-center justify-center w-full max-w-xs h-20 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700'>
                    <p className='text-[#60708a] dark:text-gray-400 text-sm'>
                      Componente CAPTCHA aqui
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          </main>
          <footer className='w-full mt-10 p-4 border-t border-solid border-t-[#f0f2f5] dark:border-t-gray-800 bg-white dark:bg-background-dark'>
            <div className='max-w-5xl mx-auto text-center'>
              <p className='text-[#60708a] dark:text-gray-500 text-sm font-normal leading-normal'>
                © 2024 ChamadosPro. Todos os direitos reservados.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
