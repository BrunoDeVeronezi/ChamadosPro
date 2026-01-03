import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

function GoogleGlyph() {
  return (
    <svg
      fill='none'
      height='24'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      viewBox='0 0 24 24'
      width='24'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M20.94 11.03A9.998 9.998 0 0 0 12 2C6.477 2 2 6.477 2 12s4.477 10 10 10a9.988 9.988 0 0 0 9.53-7.13L12 12h8.94z'></path>
    </svg>
  );
}

export default function Login2() {
  const { login, isLoading } = useAuth();

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <div className='px-4 flex flex-1 justify-center py-5 items-center'>
          <div className='layout-content-container flex flex-col max-w-md w-full flex-1'>
            <div className='flex flex-col items-center justify-center bg-white dark:bg-[#101722] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 md:p-12'>
              <div className='flex w-full justify-center bg-white dark:bg-transparent mb-6'>
                <div className='w-24 h-24 gap-1 overflow-hidden bg-white dark:bg-transparent aspect-square rounded-lg flex'>
                  <div
                    className='w-full bg-center bg-no-repeat bg-contain aspect-auto rounded-none flex-1'
                    data-alt='Logotipo do ChamadosPro, uma engrenagem estilizada com um ícone de marca de verificação dentro.'
                    style={{
                      backgroundImage:
                        'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBkqm4kniT4mcbZWqiivnVuzv4Zu-dxfh6ciXmOdT6p6HaQJld3iWHsi7SlwZo7hdsqPdyJN82K5HuD8ZG0hFvfkgkXXMs5oIoo9Pix128QTLCGaBoNifnvB7bbqBXs8b4HHdf2CY66puLL9T4QxywsRz6Ev6EGF3A5QB8K5T459Vu2qX9r_PvxFqP4XnVZvq1eJojSzPLZBPfPdDXgiBLMuMyE4e4uGF-XDP-ChHRD2qFCbGdmXR_gZqhPdxEiQTfE2ObMbnT4AnQ")',
                    }}
                  ></div>
                </div>
              </div>
              <h1 className='text-gray-900 dark:text-white tracking-tight text-[28px] font-bold leading-tight px-4 text-center pb-2'>
                Acesse sua conta
              </h1>
              <p className='text-gray-600 dark:text-gray-400 text-base font-normal leading-normal pb-8 px-4 text-center'>
                Use sua conta Google para acessar o sistema.
              </p>
              <div className='flex px-4 py-3 justify-center w-full'>
                <Button
                  type='button'
                  onClick={login}
                  disabled={isLoading}
                  className='flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 flex-1 bg-[#3880f5] text-white gap-3 pl-5 text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#3880f5]/90 transition-colors'
                >
                  <div className='text-white'>
                    <GoogleGlyph />
                  </div>
                  <span className='truncate'>
                    {isLoading ? 'Verificando sessão...' : 'Entrar com Google'}
                  </span>
                </Button>
              </div>
            </div>
            <footer className='flex flex-col gap-4 px-5 py-8 text-center'>
              <div className='flex flex-wrap items-center justify-center gap-x-6 gap-y-2'>
                <a
                  className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal hover:text-[#3880f5] dark:hover:text-[#3880f5]'
                  href='#'
                >
                  Termos de Serviço
                </a>
                <a
                  className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal hover:text-[#3880f5] dark:hover:text-[#3880f5]'
                  href='#'
                >
                  Política de Privacidade
                </a>
              </div>
              <p className='text-gray-500 dark:text-gray-400 text-sm font-normal leading-normal'>
                © 2024 ChamadosPro. Todos os direitos reservados.
              </p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
























