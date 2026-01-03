import { useState } from 'react';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface ModalEnvioConviteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicianName: string;
  technicianId: string;
  onSend: (data: {
    technicianId: string;
    message: string;
    conditions?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function ModalEnvioConvite({
  open,
  onOpenChange,
  technicianName,
  technicianId,
  onSend,
  isLoading = false,
}: ModalEnvioConviteProps) {
  const [message, setMessage] = useState(
    `Olá, ${technicianName}!\n\nNós da [Nome da Empresa] gostaríamos de convidá-lo para se juntar à nossa rede de técnicos parceiros na plataforma ChamadosPro.\n\nAcreditamos que sua experiência seria um grande acréscimo para nossa equipe. Estamos em busca de profissionais qualificados e comprometidos, e você se encaixa perfeitamente no perfil que buscamos.\n\nEsperamos contar com sua participação e estamos à disposição para esclarecer qualquer dúvida.\n\nAtenciosamente,\nEquipe [Nome da Empresa]`
  );
  const [conditions, setConditions] = useState('');
  const [showConditions, setShowConditions] = useState(false);

  const handleSend = async () => {
    await onSend({
      technicianId,
      message,
      conditions: conditions.trim() || undefined,
    });
    // Resetar formulário após envio bem-sucedido
    setMessage(
      `Olá, ${technicianName}!\n\nNós da [Nome da Empresa] gostaríamos de convidá-lo para se juntar à nossa rede de técnicos parceiros na plataforma ChamadosPro.\n\nAcreditamos que sua experiência seria um grande acréscimo para nossa equipe. Estamos em busca de profissionais qualificados e comprometidos, e você se encaixa perfeitamente no perfil que buscamos.\n\nEsperamos contar com sua participação e estamos à disposição para esclarecer qualquer dúvida.\n\nAtenciosamente,\nEquipe [Nome da Empresa]`
    );
    setConditions('');
    setShowConditions(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Resetar formulário ao cancelar
    setMessage(
      `Olá, ${technicianName}!\n\nNós da [Nome da Empresa] gostaríamos de convidá-lo para se juntar à nossa rede de técnicos parceiros na plataforma ChamadosPro.\n\nAcreditamos que sua experiência seria um grande acréscimo para nossa equipe. Estamos em busca de profissionais qualificados e comprometidos, e você se encaixa perfeitamente no perfil que buscamos.\n\nEsperamos contar com sua participação e estamos à disposição para esclarecer qualquer dúvida.\n\nAtenciosamente,\nEquipe [Nome da Empresa]`
    );
    setConditions('');
    setShowConditions(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='relative'>
          <DialogTitle className='text-[#111418] dark:text-white text-2xl font-bold leading-tight tracking-tight pr-8'>
            Enviar Convite de Parceria
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Formulario para enviar convite de parceria ao tecnico.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Campo Para */}
          <div>
            <label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal mb-2 block'>
              Para:
            </label>
            <p className='text-[#111418] dark:text-white text-lg font-semibold leading-normal'>
              {technicianName}
            </p>
          </div>

          {/* Mensagem do Convite */}
          <div>
            <label className='text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal mb-2 block'>
              Mensagem do Convite
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className='min-h-[200px] resize-y text-[#111418] dark:text-white bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 focus:outline-0 focus:ring-2 focus:ring-primary/50 rounded-lg px-4 py-3 text-base font-normal leading-normal placeholder:text-[#60708a] dark:placeholder:text-gray-400'
              placeholder='Digite sua mensagem de convite...'
            />
          </div>

          {/* Condições da Parceria (Opcional) */}
          <div>
            <button
              type='button'
              onClick={() => setShowConditions(!showConditions)}
              className='flex items-center justify-between w-full text-left text-[#111418] dark:text-gray-200 text-sm font-medium leading-normal mb-2 hover:text-[#3880f5] dark:hover:text-blue-400 transition-colors'
            >
              <span>Adicionar Condições da Parceria (Opcional)</span>
              {showConditions ? (
                <ChevronUp className='h-4 w-4' />
              ) : (
                <ChevronDown className='h-4 w-4' />
              )}
            </button>
            {showConditions && (
              <Textarea
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                className='min-h-[120px] resize-y text-[#111418] dark:text-white bg-white dark:bg-gray-800 border border-[#dbdfe6] dark:border-gray-700 focus:outline-0 focus:ring-2 focus:ring-primary/50 rounded-lg px-4 py-3 text-base font-normal leading-normal placeholder:text-[#60708a] dark:placeholder:text-gray-400'
                placeholder='Ex: Termos de comissão, áreas de atendimento preferenciais, etc.'
              />
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className='flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700'>
          <Button
            type='button'
            variant='outline'
            onClick={handleCancel}
            disabled={isLoading}
            className='flex min-w-[100px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gray-100 dark:bg-gray-700 text-[#111418] dark:text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-gray-200 dark:hover:bg-gray-600'
          >
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handleSend}
            disabled={isLoading || !message.trim()}
            className='flex min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-[#3880f5] text-white text-sm font-bold leading-normal tracking-[0.015em] hover:bg-[#2d6bc7] disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {isLoading ? 'Enviando...' : 'Enviar Convite'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}




















