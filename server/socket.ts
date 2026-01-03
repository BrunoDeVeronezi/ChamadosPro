import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Variável global para armazenar a instância do Socket.io
let ioInstance: SocketIOServer | null = null;

/**
 * Configura o Socket.io no servidor HTTP
 */
export function setupSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    },
    // Permite usar sessões do Express
    allowRequest: async (req, callback) => {
      // Aqui você pode verificar autenticação se necessário
      callback(null, true);
    },
  });

  // Middleware para autenticação via query/session
  io.use(async (socket, next) => {
    try {
      // Tenta obter userId do handshake (enviado pelo cliente)
      const userId = socket.handshake.auth?.userId;

      if (!userId) {
        return next(new Error('Usuário não autenticado'));
      }

      // Armazena userId no socket para uso posterior
      (socket as any).userId = userId;
      next();
    } catch (error) {
      next(new Error('Erro na autenticação'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;


    // Entrar na sala do tenant
    socket.on('join:tenant', (tenantId: string) => {
      socket.join(`tenant:${tenantId}`);
    });

    // Sair da sala do tenant
    socket.on('leave:tenant', (tenantId: string) => {
      socket.leave(`tenant:${tenantId}`);
    });

    // Evento de ping/pong para manter conexão viva
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Evento: Cliente desconectou
    socket.on('disconnect', () => {
    });
  });

  // Exportar função para emitir eventos
  (io as any).emitToTenant = (tenantId: string, event: string, data: any) => {
    io.to(`tenant:${tenantId}`).emit(event, data);
  };

  // Armazenar instância globalmente
  ioInstance = io;

  return io;
}

/**
 * Obtém a instância do Socket.io (deve ser chamado após setupSocketIO)
 */
export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Emite evento para todos os usuários de um tenant
 */
export function emitToTenant(tenantId: string, event: string, data: any) {
  if (!ioInstance) {
    console.warn('[Socket.io] Instância não disponível, evento não emitido');
    return;
  }
  ioInstance.to(`tenant:${tenantId}`).emit(event, data);
}
