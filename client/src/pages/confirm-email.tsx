import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Mail } from 'lucide-react';

export default function ConfirmEmail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  const sendCode = async () => {
    try {
      setLoadingSend(true);
      setStatus('idle');
      setMessage('');
      const res = await fetch('/api/auth/send-email-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Falha ao enviar código');
      }
      setStatus('success');
      setMessage('Código reenviado para seu email.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Erro ao enviar código');
    } finally {
      setLoadingSend(false);
    }
  };

  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setStatus('error');
      setMessage('Informe o código de 6 dígitos recebido por email.');
      return;
    }

    try {
      setLoadingConfirm(true);
      setStatus('idle');
      setMessage('');
      const res = await fetch('/api/auth/confirm-email-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Código inválido ou expirado');
      }

      setStatus('success');
      setMessage(data.message || 'Email confirmado com sucesso');
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      // Redirecionar para dashboard após confirmação
      setTimeout(() => {
        window.location.href = '/';
      }, 1200);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Erro ao confirmar email');
    } finally {
      setLoadingConfirm(false);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-10'>
      <div className='w-full max-w-md flex flex-col items-center space-y-8'>
        {/* Ícone de Email */}
        <div className='w-24 h-24 rounded-full bg-slate-700/50 flex items-center justify-center'>
          <Mail className='w-12 h-12 text-blue-500' />
        </div>

        {/* Título */}
        <h1 className='text-3xl font-bold text-white text-center'>
          Confirme seu e-mail
        </h1>

        {/* Texto Explicativo */}
        <p className='text-white/90 text-center text-base leading-relaxed max-w-sm'>
          Enviamos um código de confirmação para o seu e-mail. Por favor,
          verifique sua caixa de entrada (e a pasta de spam) para concluir o
          seu cadastro.
        </p>

        {/* Mensagens de Status */}
        {status !== 'idle' && message && (
          <Alert
            className={
              status === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }
          >
            <AlertDescription className='text-sm'>{message}</AlertDescription>
          </Alert>
        )}

        {/* Formulário de Código */}
        <form onSubmit={handleSubmit} className='w-full space-y-6'>
          <div className='space-y-2'>
            <Input
              placeholder='Digite o código'
              value={code}
              onChange={(e) => {
                // Aceitar apenas números e limitar a 6 dígitos
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
              }}
              maxLength={6}
              inputMode='numeric'
              pattern='[0-9]{6}'
              className='text-center text-2xl font-mono tracking-widest h-14 bg-slate-800/50 border-slate-700 text-white placeholder:text-white/40 focus:border-blue-500 focus:ring-blue-500'
              autoFocus
            />
          </div>

          {/* Link de Reenviar */}
          <div className='text-center'>
            <span className='text-white/70 text-sm'>
              Não recebeu o e-mail?{' '}
            </span>
            <button
              type='button'
              onClick={sendCode}
              disabled={loadingSend}
              className='text-blue-500 hover:text-blue-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loadingSend ? 'Enviando...' : 'Reenviar'}
            </button>
          </div>

          {/* Botão de Confirmar */}
          <Button
            type='submit'
            className='w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            disabled={loadingConfirm || code.length !== 6}
          >
            {loadingConfirm ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </form>

        {/* Botão Voltar para Login */}
        <Button
          type='button'
          variant='ghost'
          onClick={() => navigate('/login')}
          className='w-full h-12 text-white/70 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors'
        >
          Voltar para o Login
        </Button>
      </div>
    </div>
  );
}
