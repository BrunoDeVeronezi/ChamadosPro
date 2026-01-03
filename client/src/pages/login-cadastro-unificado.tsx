import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getTrialDeviceId } from '@/lib/device-id';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { ChamadosProLogo } from '@/components/chamados-pro-logo';

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

export default function LoginCadastroUnificado() {
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState<'entrar' | 'cadastrar'>('entrar');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialError, setSpecialError] = useState<string | null>(null);
  // Estados para erros específicos de cada campo
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  // Estados para modais de redirecionamento
  const [showEmailExistsModal, setShowEmailExistsModal] = useState(false);
  const [showGoogleAccountModal, setShowGoogleAccountModal] = useState(false);
  const [emailToRedirect, setEmailToRedirect] = useState<string>('');

  // Função para validar email
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // Validação em tempo real
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    // Validação em tempo real apenas se já digitou algo
    if (value.length > 0) {
      if (!validateEmail(value)) {
        setEmailError('E-mail inválido');
      } else {
        setEmailError(null);
      }
    } else {
      setEmailError(null);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    
    // Validação em tempo real apenas se já digitou algo
    if (value.length > 0) {
      if (value.length < 8) {
        setPasswordError('Senha muito curta (mínimo de 8 caracteres)');
      } else {
        setPasswordError(null);
      }
      
      // Se há confirmação de senha, validar novamente
      if (confirmPassword && value !== confirmPassword) {
        setConfirmPasswordError('As senhas não coincidem');
      } else if (confirmPassword) {
        setConfirmPasswordError(null);
      }
    } else {
      setPasswordError(null);
      if (confirmPassword) {
        setConfirmPasswordError('As senhas não coincidem');
      }
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);
    
    // Validação em tempo real apenas se já digitou algo
    if (value.length > 0) {
      if (value !== password) {
        setConfirmPasswordError('As senhas não coincidem');
      } else {
        setConfirmPasswordError(null);
      }
    } else {
      setConfirmPasswordError(null);
    }
  };

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFullName(value);
    
    // Validação em tempo real apenas se já digitou algo e depois apagou
    if (value.length === 0 && authMode === 'cadastrar') {
      // Não mostrar erro enquanto está digitando, apenas se tentar submeter vazio
      setFullNameError(null);
    } else {
      setFullNameError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSpecialError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setFullNameError(null);

    try {
      if (authMode === 'entrar') {
        // Validação de email antes de enviar
        if (!validateEmail(email)) {
          setEmailError('Por favor, insira um e-mail válido.');
          setIsSubmitting(false);
          return;
        }

        // Login com email/senha
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // Invalidar cache do React Query e forçar refetch
          const { queryClient } = await import('@/lib/queryClient');
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          queryClient.removeQueries({ queryKey: ['/api/auth/user'] }); // Remove completamente do cache

          toast({
            title: 'Login realizado',
            description: 'Bem-vindo de volta!',
          });

          // Aguardar um pouco para garantir que a sessão foi criada
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Verificar se o usuário é master admin e redirecionar
          const userResponse = await fetch('/api/auth/user', {
            credentials: 'include',
            cache: 'no-store', // Forçar buscar dados novos
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log('[LOGIN] Dados do usuário após login:', {
              id: userData.id,
              email: userData.email,
              role: userData.role,
              isProfile: userData.isProfile,
              profileId: userData.profileId,
            });

            // Se for master admin, redirecionar para o painel master admin
            if (userData && userData.role === 'super_admin') {
              console.log('[LOGIN] Redirecionando para /master-admin');
              window.location.href = '/master-admin';
              return;
            }
          } else {
            console.error(
              '[LOGIN] Erro ao buscar dados do usuário:',
              userResponse.status
            );
          }

          // Redirecionar para a página inicial
          console.log('[LOGIN] Redirecionando para /');
          window.location.href = '/';
        } else {
          // Tratar erros específicos do login
          const errorMessage = data.message || 'Erro ao fazer login';
          
          if (response.status === 401) {
            // Para erros de autenticação, mostramos mensagem genérica abaixo da senha
            setPasswordError('E-mail ou senha incorretos.');
          } else if (errorMessage.toLowerCase().includes('google')) {
            setSpecialError(errorMessage);
          } else {
            toast({
              variant: 'destructive',
              title: 'Erro',
              description: errorMessage,
            });
          }
          
          setIsSubmitting(false);
        }
      } else {
        // Validações de cadastro
        let hasErrors = false;

        // Validação de nome completo
        if (!fullName.trim()) {
          setFullNameError('Nome completo é obrigatório');
          hasErrors = true;
        }

        // Validação de email
        if (!validateEmail(email)) {
          setEmailError('E-mail inválido');
          hasErrors = true;
        }

        // Validação de senha mínima (8 caracteres)
        if (password.length < 8) {
          setPasswordError('Senha muito curta (mínimo de 8 caracteres)');
          hasErrors = true;
        }

        // Validação de confirmação de senha
        if (password !== confirmPassword) {
          setConfirmPasswordError('As senhas não coincidem');
          hasErrors = true;
        }

        if (hasErrors) {
          setIsSubmitting(false);
          return;
        }

        // Cadastro unificado - não precisa mais escolher tipo
        // O sistema cria como 'technician' por padrão e o usuário pode fazer upgrade depois
        console.log('[FRONTEND] Tentando cadastrar:', {
          email,
          fullName,
        });

        // Separar nome e sobrenome
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password,
            userType: 'technician', // Padrão: técnico (pode fazer upgrade depois)
            firstName: firstName || email.split('@')[0], // Usar nome completo ou fallback
            lastName: lastName,
            trialDeviceId: getTrialDeviceId(),
          }),
        });

        // Verificar se a resposta é JSON antes de fazer parse
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (jsonError) {
            // Se falhar ao fazer parse do JSON, ler como texto para debug
            const text = await response.clone().text();
            console.error('[FRONTEND] Erro ao fazer parse do JSON:', {
              status: response.status,
              contentType,
              text: text.substring(0, 500), // Primeiros 500 caracteres
              jsonError,
            });
            throw new Error(
              `Erro no servidor: resposta inválida (${response.status}). O servidor retornou HTML em vez de JSON.`
            );
          }
        } else {
          // Se não for JSON, ler como texto para debug
          const text = await response.text();
          console.error('[FRONTEND] Resposta não é JSON:', {
            status: response.status,
            contentType,
            text: text.substring(0, 500), // Primeiros 500 caracteres
          });
          throw new Error(
            `Erro no servidor: resposta inválida (${
              response.status
            }). O servidor retornou ${
              contentType || 'tipo desconhecido'
            } em vez de JSON.`
          );
        }

        console.log('[FRONTEND] Resposta do cadastro:', {
          status: response.status,
          ok: response.ok,
          data,
        });

        if (response.ok) {
          // Redirecionar para confirmação de email primeiro (forçar navegação)
          toast({
            title: 'Conta criada com sucesso!',
            description: 'Enviamos um código de confirmação para seu email.',
          });
          window.location.href = '/confirm-email';
        } else {
          if (response.status === 409) {
            const existingEmail = data?.email || email;

            // Verificar se é conta Google - mostrar modal e depois redirecionar
            if (
              data?.code === 'EMAIL_EXISTS_GOOGLE' ||
              data?.provider === 'google'
            ) {
              setEmailToRedirect(existingEmail);
              setShowGoogleAccountModal(true);
              setIsSubmitting(false);
              return; // Não mostrar erro, modal será exibido
            }

            // Conta email/senha já existe - mostrar modal e depois mudar para login
            setEmailToRedirect(existingEmail);
            setShowEmailExistsModal(true);
            setIsSubmitting(false);
            return; // Não lançar erro, modal será exibido
          }
          throw new Error(data?.message || 'Erro ao cadastrar');
        }
      }
    } catch (error: any) {
      const msg = error.message || 'Ocorreu um erro. Tente novamente.';
      // Se não definiu specialError acima (erro genérico), verificar pela mensagem
      if (msg.toLowerCase().includes('google') && !specialError) {
        setSpecialError(
          'Este email já está cadastrado via Google. Faça login com Google usando o botão "Entrar com Google" acima.'
        );
      }
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para modal de conta email/senha existente
  const handleEmailExistsConfirm = () => {
    setShowEmailExistsModal(false);
    setAuthMode('entrar');
    setEmail(emailToRedirect);
    setPassword('');
    toast({
      title: 'Email já cadastrado',
      description: 'Preencha sua senha para fazer login.',
    });
  };

  // Handler para modal de conta Google
  const handleGoogleAccountConfirm = () => {
    setShowGoogleAccountModal(false);
    // Redirecionar para OAuth do Google com login_hint
    const loginUrl = `/api/login?login_hint=${encodeURIComponent(
      emailToRedirect
    )}`;
    window.location.href = loginUrl;
  };

  return (
    <div className='relative flex min-h-screen w-full flex-col bg-[#0f172a] dark:bg-[#0f172a] font-display overflow-x-hidden'>
      <div className='layout-container flex h-full grow flex-col'>
        <div className='flex flex-1'>
          <div className='w-full min-h-screen flex items-center justify-center p-4 sm:p-8'>
            <div className='flex flex-col max-w-[480px] flex-1'>
              {/* Header com seta de voltar e título - apenas no modo cadastro */}
              {authMode === 'cadastrar' && (
                <div className='w-full mb-8'>
                  <button
                    onClick={() => {
                      setAuthMode('entrar');
                      setPassword('');
                      setConfirmPassword('');
                      setFullName('');
                      setEmail('');
                      setSpecialError(null);
                      setEmailError(null);
                      setPasswordError(null);
                      setConfirmPasswordError(null);
                      setFullNameError(null);
                    }}
                    className='text-white hover:text-gray-300 transition-colors flex items-center gap-2 mb-6'
                  >
                    <ArrowLeft className='w-5 h-5' />
                  </button>
                  <h1 className='text-white text-3xl font-bold text-center'>
                    Crie sua conta
                  </h1>
                </div>
              )}

              {/* Título para modo login */}
              {authMode === 'entrar' && (
                <>
                  {/* Logo Chamados Pro */}
                  <div className='flex justify-center mb-8'>
                    <ChamadosProLogo size={80} showText={true} />
                  </div>
                  <h1 className='text-white text-3xl font-bold text-center mb-2'>
                    Bem-vindo de volta!
                  </h1>
                  <p className='text-gray-400 text-base text-center mb-8'>
                    Faça login para continuar.
                  </p>
                </>
              )}

              {/* Alertas de erro genérico (apenas para erros não relacionados a campos) */}
              {specialError && (
                <div className='mb-6'>
                  <Alert variant='destructive'>
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{specialError}</AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Google Login Button - Mostrar primeiro no modo cadastro */}
              {authMode === 'cadastrar' && (
                <>
                  <Button
                    type='button'
                    onClick={() => {
                      window.location.href = `/api/login`;
                    }}
                    disabled={isLoading}
                    className='flex w-full cursor-pointer items-center justify-center rounded-lg h-12 px-5 bg-white text-gray-900 text-base font-medium leading-normal tracking-[0.015em] hover:bg-gray-100 transition-colors disabled:opacity-50 mb-6'
                  >
                    <GoogleGlyph />
                    <span className='ml-3 truncate'>Continuar com o Google</span>
                  </Button>

                  {/* Divider */}
                  <div className='flex items-center gap-4 mb-6'>
                    <div className='flex-1 h-px bg-gray-700'></div>
                    <span className='text-gray-400 text-sm'>OU</span>
                    <div className='flex-1 h-px bg-gray-700'></div>
                  </div>
                </>
              )}

              {/* Form Fields */}
              <form
                onSubmit={handleSubmit}
                className='flex flex-col gap-5 w-full mb-6'
              >
                {authMode === 'cadastrar' && (
                  <div className='space-y-2'>
                    <Label
                      className='block text-sm font-medium text-white'
                      htmlFor='fullName'
                    >
                      Nome Completo
                    </Label>
                    <Input
                      className={`block w-full h-12 px-4 rounded-lg bg-gray-800/50 text-white placeholder:text-gray-500 border focus:ring-[#3880f5] focus:border-[#3880f5] ${
                        fullNameError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-600'
                      }`}
                      id='fullName'
                      placeholder='Nome Completo'
                      type='text'
                      value={fullName}
                      onChange={handleFullNameChange}
                      onBlur={() => {
                        if (!fullName.trim() && authMode === 'cadastrar') {
                          setFullNameError('Nome completo é obrigatório');
                        }
                      }}
                      required
                    />
                    {fullNameError && (
                      <p className='text-red-500 text-sm'>{fullNameError}</p>
                    )}
                  </div>
                )}

                <div className='space-y-2'>
                  <Label
                    className='block text-sm font-medium text-white'
                    htmlFor='email'
                  >
                    E-mail
                  </Label>
                  <Input
                    className={`block w-full h-12 px-4 rounded-lg bg-gray-800/50 text-white placeholder:text-gray-500 border focus:ring-[#3880f5] focus:border-[#3880f5] ${
                      emailError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-600'
                    }`}
                    id='email'
                    placeholder={authMode === 'cadastrar' ? 'seuemail@dominio.com' : 'seuemail@exemplo.com'}
                    type='email'
                    value={email}
                    onChange={handleEmailChange}
                    required
                  />
                  {emailError && (
                    <p className='text-red-500 text-sm'>{emailError}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  <Label
                    className='block text-sm font-medium text-white'
                    htmlFor='password'
                  >
                    Senha
                  </Label>
                  <div className='relative'>
                    <Input
                      className={`block w-full h-12 px-4 pr-12 rounded-lg bg-gray-800/50 text-white placeholder:text-gray-500 border focus:ring-[#3880f5] focus:border-[#3880f5] ${
                        passwordError
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                          : 'border-gray-600'
                      }`}
                      id='password'
                      placeholder={authMode === 'cadastrar' ? 'Crie sua senha' : '••••••••'}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={handlePasswordChange}
                      required
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
                    >
                      {showPassword ? (
                        <EyeOff className='w-5 h-5' />
                      ) : (
                        <Eye className='w-5 h-5' />
                      )}
                    </button>
                  </div>
                  {authMode === 'cadastrar' && passwordError && (
                    <p className='text-red-500 text-sm'>{passwordError}</p>
                  )}
                  {authMode === 'entrar' && (
                    <div className='flex justify-between items-start mt-1'>
                      {passwordError && (
                        <p className='text-red-500 text-sm flex-1'>{passwordError}</p>
                      )}
                      <button
                        type='button'
                        onClick={() => setLocation('/recuperar-senha')}
                        className='text-sm text-[#3880f5] hover:underline ml-auto'
                      >
                        Esqueceu a Senha?
                      </button>
                    </div>
                  )}
                </div>

                {authMode === 'cadastrar' && (
                  <div className='space-y-2'>
                    <Label
                      className='block text-sm font-medium text-white'
                      htmlFor='confirmPassword'
                    >
                      Confirmar Senha
                    </Label>
                    <div className='relative'>
                      <Input
                        className={`block w-full h-12 px-4 pr-12 rounded-lg bg-gray-800/50 text-white placeholder:text-gray-500 border focus:ring-[#3880f5] focus:border-[#3880f5] ${
                          confirmPasswordError
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-600'
                        }`}
                        id='confirmPassword'
                        placeholder='Confirme sua senha'
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={handleConfirmPasswordChange}
                        required
                      />
                      <button
                        type='button'
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors'
                      >
                        {showConfirmPassword ? (
                          <EyeOff className='w-5 h-5' />
                        ) : (
                          <Eye className='w-5 h-5' />
                        )}
                      </button>
                    </div>
                    {confirmPasswordError && (
                      <p className='text-red-500 text-sm'>{confirmPasswordError}</p>
                    )}
                  </div>
                )}

                {/* CTA Button */}
                  <Button
                    type='submit'
                    disabled={isSubmitting || isLoading}
                  className='flex w-full cursor-pointer items-center justify-center rounded-lg h-12 px-5 bg-[#3880f5] text-white text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#2d6bd8] transition-colors disabled:opacity-50'
                  >
                    <span className='truncate'>
                      {isSubmitting
                        ? 'Processando...'
                        : authMode === 'entrar'
                        ? 'Entrar'
                        : 'Cadastrar'}
                    </span>
                  </Button>
              </form>

              {/* Divider para modo login */}
              {authMode === 'entrar' && (
                <>
                  <div className='flex items-center gap-4 mb-6'>
                    <div className='flex-1 h-px bg-gray-700'></div>
                    <span className='text-gray-400 text-sm'>ou</span>
                    <div className='flex-1 h-px bg-gray-700'></div>
                  </div>

                  {/* Google Login Button */}
                  <Button
                    type='button'
                    onClick={() => {
                      window.location.href = `/api/login`;
                    }}
                    disabled={isLoading}
                    className='flex w-full cursor-pointer items-center justify-center rounded-lg h-12 px-5 bg-gray-800 text-white text-base font-medium leading-normal tracking-[0.015em] border border-gray-700 hover:bg-gray-700 transition-colors disabled:opacity-50'
                  >
                    <GoogleGlyph />
                    <span className='ml-3 truncate'>Entrar com Google</span>
                  </Button>
                </>
              )}

              {/* Link para alternar entre login e cadastro */}
              <div className='mt-8 text-center'>
                {authMode === 'entrar' ? (
                  <p className='text-gray-400 text-sm'>
                    Não tem uma conta?{' '}
                    <button
                      onClick={() => {
                        setAuthMode('cadastrar');
                        setPassword('');
                        setConfirmPassword('');
                        setFullName('');
                        setEmail('');
                        setSpecialError(null);
                        setEmailError(null);
                        setPasswordError(null);
                        setConfirmPasswordError(null);
                        setFullNameError(null);
                      }}
                      className='text-[#3880f5] hover:underline font-medium'
                    >
                      Cadastre-se
                    </button>
                  </p>
                ) : (
                  <p className='text-gray-400 text-sm'>
                    Já tem uma conta?{' '}
                    <button
                      onClick={() => {
                        setAuthMode('entrar');
                        setPassword('');
                        setConfirmPassword('');
                        setFullName('');
                        setEmail('');
                        setSpecialError(null);
                        setEmailError(null);
                        setPasswordError(null);
                        setConfirmPasswordError(null);
                        setFullNameError(null);
                      }}
                      className='text-[#3880f5] hover:underline font-medium'
                    >
                      Entrar
                    </button>
                  </p>
                )}
              </div>

              {/* Legal Text */}
              {authMode === 'cadastrar' && (
                <p className='text-xs text-gray-500 mt-6 px-4 text-center'>
                Ao se cadastrar, você concorda com nossos{' '}
                <a className='text-[#3880f5] hover:underline' href='#'>
                  Termos de Serviço
                </a>{' '}
                e{' '}
                <a className='text-[#3880f5] hover:underline' href='#'>
                  Política de Privacidade
                </a>
                .
              </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Email já cadastrado (conta email/senha) */}
      <Dialog
        open={showEmailExistsModal}
        onOpenChange={setShowEmailExistsModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email já cadastrado</DialogTitle>
            <DialogDescription>
              O email <strong>{emailToRedirect}</strong> já está cadastrado no
              sistema. Faça login com sua senha para acessar sua conta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowEmailExistsModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleEmailExistsConfirm}>Ir para login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Email é conta Google */}
      <Dialog
        open={showGoogleAccountModal}
        onOpenChange={setShowGoogleAccountModal}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conta Google detectada</DialogTitle>
            <DialogDescription>
              O email <strong>{emailToRedirect}</strong> já está cadastrado via
              Google. Você será redirecionado para fazer login com sua conta
              Google.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowGoogleAccountModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleGoogleAccountConfirm}>
              Entrar com Google
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
