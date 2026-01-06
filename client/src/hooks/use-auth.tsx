import { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  publicSlug: string;
  role?: 'technician' | 'company' | 'super_admin' | 'operational' | 'financial';
  companyName?: string;
  companyLogoUrl?: string;
  emailConfirmed?: boolean;
  profileCompleted?: boolean;
  requirePassword?: boolean;
  isProfile?: boolean;
  profileId?: string;
  planType?: 'tech';
  planStatus?: 'trial' | 'active' | 'expired';
  trialEndsAt?: string;
  trialDeleteAt?: string;
  trialDaysLeft?: number;
  asaasCustomerId?: string | null;
  tenantSlug?: string | null;
  phone?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  birthDate?: string | null;
  zipCode?: string | null;
  streetAddress?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  emailConfirmationExpiresAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requirePassword: boolean;
  // login: () => void;
  // logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    retry: false,
    staleTime: 0, // Sempre considerar dados como stale para forçar refetch
    refetchOnMount: true, // Sempre refetch quando o componente montar
    refetchOnWindowFocus: true, // Refetch quando a janela receber foco
    queryFn: async () => {
      const res = await fetch('/api/auth/user', {
        credentials: 'include',
        cache: 'no-store', // Não usar cache do navegador
      });
      if (res.status === 401) {
        return null;
      }
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      const userData = (await res.json()) as User;
      return userData;
    },
  });

  useEffect(() => {
    setIsAuthenticated(!!user && !error);
  }, [user, error]);

  const login = () => {
    window.location.href = '/api/login';
  };

  const logout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        isAuthenticated,
        requirePassword: !!user?.requirePassword,
        // login,
        // logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
