import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './use-auth';
import { queryClient } from '@/lib/queryClient';

/**
 * Hook para gerenciar conexão Socket.io e atualizações em tempo real
 */
export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    // Conectar ao servidor Socket.io
    const socket = io(window.location.origin, {
      auth: {
        userId: user.id,
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Entrar na sala do tenant (empresa ou técnico)
      // Para perfis, usar o companyId
      const tenantId = (user as any)?.isProfile
        ? (user as any)?.profileId || user.id
        : user.id;

      socket.emit('join:tenant', tenantId);
    });

    socket.on('disconnect', () => {
      // Socket desconectado
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Erro de conexão:', error);
    });

    // Escutar atualizações de chamados
    socket.on('ticket:created', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    socket.on('ticket:updated', (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      // Se tiver ID específico, invalidar query específica
      if (data.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/tickets', data.id] });
      }
    });

    socket.on('ticket:deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    socket.on('ticket:status:changed', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    });

    // Escutar atualizações de clientes
    socket.on('client:created', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    });

    socket.on('client:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    });

    socket.on('client:deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    });

    // Escutar atualizações de agendamentos
    socket.on('appointment:created', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    });

    socket.on('appointment:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agenda'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
    });

    // Limpeza ao desmontar
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, (user as any)?.isProfile, (user as any)?.profileId]);

  return socketRef.current;
}
