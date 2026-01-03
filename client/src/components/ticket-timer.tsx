import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TicketTimerProps {
  startedAt: string;
  stoppedAt: string;
}

export function TicketTimer({ startedAt, stoppedAt }: TicketTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    
    // Verificar se a data de início é válida
    if (isNaN(startTime)) {
      setElapsed(0);
      return;
    }

    const calculateElapsed = () => {
      const end = stoppedAt ? new Date(stoppedAt).getTime() : Date.now();
      const elapsedSeconds = Math.floor((end - startTime) / 1000);
      return Math.max(0, elapsedSeconds);
    };

    // Atualizar imediatamente
    setElapsed(calculateElapsed());

    // Se não foi parado, configurar intervalo para atualizar a cada segundo
    if (!stoppedAt) {
      const interval = setInterval(() => {
        setElapsed(calculateElapsed());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [startedAt, stoppedAt]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div
      className='flex items-center gap-2 text-sm font-mono'
      data-testid='text-timer'
    >
      <Clock className='h-4 w-4' />
      <span>
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:
        {String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
