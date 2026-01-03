import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, Mail } from 'lucide-react';

export default function MasterAdminLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/master-admin/login', {
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
        // Invalidar cache do React Query
        const { queryClient } = await import('@/lib/queryClient');
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });

        toast({
          title: 'Login realizado',
          description: 'Bem-vindo ao Painel Master Admin!',
        });

        // Redirecionar para o painel master admin
        setTimeout(() => {
          setLocation('/master-admin');
        }, 100);
      } else {
        throw new Error(data.message || 'Erro ao fazer login');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer login',
        description: error.message || 'Credenciais inválidas',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4'>
      <Card className='w-full max-w-md p-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-2xl'>
        <div className='flex flex-col items-center mb-8'>
          <div className='w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
            <Shield className='w-8 h-8 text-primary' />
          </div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
            Master Admin
          </h1>
          <p className='text-gray-600 dark:text-gray-400 text-sm'>
            Acesso exclusivo ao painel de administração
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='email' className='text-gray-900 dark:text-white'>
              Email
            </Label>
            <div className='relative'>
              <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <Input
                id='email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='master@master.com'
                className='pl-10 h-12'
                required
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='password' className='text-gray-900 dark:text-white'>
              Senha
            </Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <Input
                id='password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder='••••••••'
                className='pl-10 h-12'
                required
              />
            </div>
          </div>

          <Button
            type='submit'
            className='w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold'
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className='mt-6 pt-6 border-t border-gray-200 dark:border-gray-700'>
          <p className='text-xs text-center text-gray-500 dark:text-gray-400'>
            Acesso restrito ao administrador do sistema
          </p>
        </div>
      </Card>
    </div>
  );
}



















