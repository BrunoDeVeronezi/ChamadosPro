import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { X, Info } from 'lucide-react';

interface ModalCancelamentoChamado2Props {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  ticketNumber: string;
}

export default function ModalCancelamentoChamado2({
  isOpen,
  onClose,
  ticketId,
  ticketNumber,
}: ModalCancelamentoChamado2Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [cancellationSource, setCancellationSource] = useState<
    'Cliente' | 'Técnico'
  >('Cliente');
  const [cancellationReason, setCancellationReason] = useState('');

  const cancelMutation = useMutation({
    mutationFn: async (data: {
      cancellationSource: string;
      cancellationReason: string;
    }) => {
      const response = await apiRequest(
        'POST',
        `/api/tickets/${ticketId}/cancel`,
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao cancelar chamado');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets', ticketId] });
      toast({
        title: 'Chamado cancelado',
        description: 'O chamado foi cancelado com sucesso.',
      });
      onClose();
      setLocation('/chamados');
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar chamado',
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, informe o motivo do cancelamento.',
      });
      return;
    }
    cancelMutation.mutate({
      cancellationSource,
      cancellationReason,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='w-full max-w-lg bg-background-dark border border-slate-800 shadow-2xl'>
        <DialogHeader>
          <div className='flex items-start justify-between'>
            <div className='flex flex-col gap-1'>
              <DialogTitle className='text-xl font-bold text-white'>
                Cancelar Chamado #{ticketNumber}
              </DialogTitle>
              <DialogDescription className='text-sm text-slate-400'>
                Por favor, informe os detalhes do cancelamento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='flex flex-col gap-5 pt-2'>
          <div className='flex flex-col gap-2'>
            <Label className='text-sm font-medium text-slate-200'>
              Quem solicitou o cancelamento?
            </Label>
            <div className='flex h-10 w-full items-center justify-center rounded-lg bg-slate-800 p-1'>
              <label
                className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-colors ${
                  cancellationSource === 'Cliente'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400'
                }`}
              >
                <span className='truncate'>Cliente</span>
                <input
                  checked={cancellationSource === 'Cliente'}
                  onChange={() => setCancellationSource('Cliente')}
                  className='invisible w-0'
                  name='cancel-source'
                  type='radio'
                  value='Cliente'
                />
              </label>
              <label
                className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-colors ${
                  cancellationSource === 'Técnico'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400'
                }`}
              >
                <span className='truncate'>Técnico</span>
                <input
                  checked={cancellationSource === 'Técnico'}
                  onChange={() => setCancellationSource('Técnico')}
                  className='invisible w-0'
                  name='cancel-source'
                  type='radio'
                  value='Técnico'
                />
              </label>
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <Label className='text-sm font-medium text-slate-200'>
              Motivo do Cancelamento
            </Label>
            <Textarea
              className='form-input flex min-h-32 w-full flex-1 resize-none overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm font-normal text-slate-200 placeholder:text-slate-500 focus:border-primary/80 focus:outline-0 focus:ring-2 focus:ring-primary/20'
              placeholder='Ex: Cliente solicitou o reagendamento para outra data / Peça necessária não está em estoque.'
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              required
            />
          </div>

          <div className='flex items-center gap-3 rounded-lg bg-primary/10 p-3'>
            <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary/80'>
              <Info className='w-4 h-4' />
            </div>
            <p className='flex-1 text-sm font-normal leading-normal text-blue-200'>
              A ação removerá o evento do Google Calendar.
            </p>
          </div>

          <DialogFooter className='flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4'>
            <Button
              type='button'
              variant='outline'
              className='flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-slate-700 px-4 text-sm font-bold leading-normal tracking-[0.015em] text-white transition-colors hover:bg-slate-600'
              onClick={onClose}
            >
              <span className='truncate'>Voltar</span>
            </Button>
            <Button
              type='submit'
              className='flex h-10 min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-bold leading-normal tracking-[0.015em] text-white transition-colors hover:bg-primary/90'
              disabled={cancelMutation.isPending}
            >
              <span className='truncate'>
                {cancelMutation.isPending
                  ? 'Cancelando...'
                  : 'Confirmar Cancelamento'}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}






















