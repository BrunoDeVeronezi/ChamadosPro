import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { User, Building2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getTrialDeviceId } from '@/lib/device-id';

function GoogleGlyph() {
  return (
    <svg
      fill='currentColor'
      height='24'
      viewBox='0 0 24 24'
      width='24'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M21.35 11.1H12.18V13.83H18.69C18.36 17.64 15.19 19.27 12.19 19.27C8.36 19.27 5.03 16.09 5.03 12.25C5.03 8.41 8.36 5.23 12.19 5.23C13.83 5.23 15.24 5.82 16.29 6.82L18.44 4.67C16.56 2.89 14.48 2 12.19 2C6.98 2 2.86 6.36 2.86 12.25C2.86 18.14 6.98 22.5 12.19 22.5C17.6 22.5 21.5 18.33 21.5 12.42C21.5 11.83 21.45 11.46 21.35 11.1Z'></path>
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg
      fill='currentColor'
      height='24'
      viewBox='0 0 24 24'
      width='24'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg
      fill='currentColor'
      height='24'
      viewBox='0 0 24 24'
      width='24'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z' />
    </svg>
  );
}

export default function Login() {
  const [userType, setUserType] = useState<'technician' | 'company'>(
    'technician'
  );
  const [authMethod, setAuthMethod] = useState<'oauth' | 'email'>('oauth');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [specialError, setSpecialError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOAuthLogin = (provider: 'google' | 'facebook' | 'instagram') => {
    const role = userType === 'technician' ? 'technician' : 'company';
    window.location.href = `/api/auth/${provider}?role=${role}`;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSpecialError(null);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await apiRequest('POST', endpoint, {
        email,
        password,
        role: userType === 'technician' ? 'technician' : 'company',
        trialDeviceId: getTrialDeviceId(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao autenticar');
      }

      const data = await response.json();
      toast({
        title: isLogin ? 'Login realizado' : 'Cadastro realizado',
        description: isLogin
          ? 'Bem-vindo de volta!'
          : 'Sua conta foi criada com sucesso!',
      });

      // Redirecionar para dashboard
      window.location.href = '/';
    } catch (error: any) {
      const msg = error.message || 'Não foi possível autenticar';
      if (msg.toLowerCase().includes('google')) {
        setSpecialError(
          'Este email já está cadastrado via Google. Entre com Google ou defina uma senha em Perfil (após entrar com Google).'
        );
      } else {
        setSpecialError(null);
      }
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='relative flex h-auto min-h-screen w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <div className='px-4 flex flex-1 justify-center py-5 items-center'>
          <div className='layout-content-container flex flex-col max-w-md w-full flex-1'>
            <Card className='bg-white dark:bg-[#1a2332] border border-gray-200 dark:border-gray-800 shadow-sm'>
              <CardHeader className='text-center pb-4'>
                <div className='flex w-full justify-center bg-transparent mb-4'>
                  <div className='w-24 h-24 gap-1 overflow-hidden bg-transparent aspect-square rounded-lg flex'>
                    <div
                      className='w-full bg-center bg-no-repeat bg-contain aspect-auto rounded-none flex-1'
                      data-alt='Logotipo do ChamadosPro'
                      style={{
                        backgroundImage:
                          'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBkqm4kniT4mcbZWqiivnVuzv4Zu-dxfh6ciXmOdT6p6HaQJld3iWHsi7SlwZo7hdsqPdyJN82K5HuD8ZG0hFvfkgkXXMs5oIoo9Pix128QTLCGaBoNifnvB7bbqBXs8b4HHdf2CY66puLL9T4QxywsRz6Ev6EGF3A5QB8K5T459Vu2qX9r_PvxFqP4XnVZvq1eJojSzPLZBPfPdDXgiBLMuMyE4e4uGF-XDP-ChHRD2qFCbGdmXR_gZqhPdxEiQTfE2ObMbnT4AnQ")',
                      }}
                    ></div>
                  </div>
                </div>
                <CardTitle className='text-2xl font-bold'>
                  Bem-vindo ao ChamadosPro
                </CardTitle>
                <p className='text-sm text-muted-foreground mt-2'>
                  {isLogin ? 'Entre na sua conta' : 'Crie sua conta'}
                </p>
              </CardHeader>

              <CardContent className='space-y-6'>
                {specialError && (
                  <Alert variant='destructive'>
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{specialError}</AlertDescription>
                  </Alert>
                )}
                {/* Seleção de Tipo de Usuário */}
                <div className='space-y-3'>
                  <Label className='text-base font-semibold'>Você é um:</Label>
                  <RadioGroup
                    value={userType}
                    onValueChange={(value) =>
                      setUserType(value as 'technician' | 'company')
                    }
                    className='grid grid-cols-2 gap-4'
                  >
                    <div>
                      <RadioGroupItem
                        value='technician'
                        id='technician'
                        className='peer sr-only'
                      />
                      <Label
                        htmlFor='technician'
                        className='flex flex-col items-center justify-between rounded-md border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer'
                      >
                        <User className='mb-3 h-6 w-6' />
                        <span className='font-semibold'>Técnico</span>
                        <span className='text-xs text-muted-foreground text-center mt-1'>
                          Prestador de serviços
                        </span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem
                        value='company'
                        id='company'
                        className='peer sr-only'
                      />
                      <Label
                        htmlFor='company'
                        className='flex flex-col items-center justify-between rounded-md border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer'
                      >
                        <Building2 className='mb-3 h-6 w-6' />
                        <span className='font-semibold'>Empresa</span>
                        <span className='text-xs text-muted-foreground text-center mt-1'>
                          Contratante de serviços
                        </span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Métodos de Autenticação OAuth */}
                {authMethod === 'oauth' && (
                  <div className='space-y-3'>
                    <div className='grid grid-cols-1 gap-3'>
                      <Button
                        type='button'
                        onClick={() => handleOAuthLogin('google')}
                        disabled={isLoading}
                        className='w-full h-12 bg-[#3880f5] hover:bg-[#3880f5]/90 text-white gap-3'
                      >
                        <GoogleGlyph />
                        <span>
                          {isLogin ? 'Entrar' : 'Cadastrar'} com Google
                        </span>
                      </Button>

                      <Button
                        type='button'
                        onClick={() => handleOAuthLogin('facebook')}
                        disabled={isLoading}
                        variant='outline'
                        className='w-full h-12 gap-3'
                      >
                        <FacebookGlyph />
                        <span>
                          {isLogin ? 'Entrar' : 'Cadastrar'} com Facebook
                        </span>
                      </Button>

                      <Button
                        type='button'
                        onClick={() => handleOAuthLogin('instagram')}
                        disabled={isLoading}
                        variant='outline'
                        className='w-full h-12 gap-3'
                      >
                        <InstagramGlyph />
                        <span>
                          {isLogin ? 'Entrar' : 'Cadastrar'} com Instagram
                        </span>
                      </Button>
                    </div>

                    <div className='relative'>
                      <div className='absolute inset-0 flex items-center'>
                        <span className='w-full border-t' />
                      </div>
                      <div className='relative flex justify-center text-xs uppercase'>
                        <span className='bg-background px-2 text-muted-foreground'>
                          Ou
                        </span>
                      </div>
                    </div>

                    <Button
                      type='button'
                      onClick={() => setAuthMethod('email')}
                      variant='outline'
                      className='w-full h-12 gap-2'
                    >
                      <Mail className='h-4 w-4' />
                      <span>Continuar com Email</span>
                    </Button>
                  </div>
                )}

                {/* Formulário de Email/Senha */}
                {authMethod === 'email' && (
                  <form onSubmit={handleEmailAuth} className='space-y-4'>
                    <div className='space-y-2'>
                      <Label htmlFor='email'>Email</Label>
                      <Input
                        id='email'
                        type='email'
                        placeholder='seu@email.com'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div className='space-y-2'>
                      <Label htmlFor='password'>Senha</Label>
                      <div className='relative'>
                        <Input
                          id='password'
                          type={showPassword ? 'text' : 'password'}
                          placeholder='••••••••'
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isLoading}
                          className='pr-10'
                        />
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <EyeOff className='h-4 w-4 text-muted-foreground' />
                          ) : (
                            <Eye className='h-4 w-4 text-muted-foreground' />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className='flex items-center justify-between text-sm'>
                      <button
                        type='button'
                        onClick={() => setIsLogin(!isLogin)}
                        className='text-primary hover:underline'
                      >
                        {isLogin
                          ? 'Não tem conta? Cadastre-se'
                          : 'Já tem conta? Entre'}
                      </button>
                      {isLogin && (
                        <button
                          type='button'
                          className='text-primary hover:underline'
                        >
                          Esqueceu a senha?
                        </button>
                      )}
                    </div>

                    <Button
                      type='submit'
                      className='w-full h-12'
                      disabled={isLoading}
                    >
                      {isLoading
                        ? 'Processando...'
                        : isLogin
                        ? 'Entrar'
                        : 'Cadastrar'}
                    </Button>

                    <Button
                      type='button'
                      onClick={() => setAuthMethod('oauth')}
                      variant='ghost'
                      className='w-full'
                      disabled={isLoading}
                    >
                      Voltar para métodos OAuth
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>

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
