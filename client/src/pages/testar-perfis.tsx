/**
 * Página de teste para os endpoints de perfis
 * Acesse: http://localhost:5180/testar-perfis
 * (Você precisa estar logado como empresa)
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  data?: any;
}

export default function TestarPerfis() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: TestResult) => {
    setResults((prev) => [...prev, result]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testEndpoint = async (
    name: string,
    method: string,
    url: string,
    body?: any
  ) => {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const data = await response.json();

      if (response.ok) {
        addResult({
          name,
          status: 'success',
          message: `Status: ${response.status}`,
          data,
        });
        return { success: true, data };
      } else {
        addResult({
          name,
          status: 'error',
          message: `Status: ${response.status} - ${data.message || 'Erro desconhecido'}`,
          data,
        });
        return { success: false, data };
      }
    } catch (error: any) {
      addResult({
        name,
        status: 'error',
        message: `Erro de conexão: ${error.message}`,
      });
      return { success: false, error: error.message };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();

    // Teste 1: Listar perfis
    await testEndpoint(
      '1. Listar perfis (GET)',
      'GET',
      '/api/company/profiles'
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Teste 2: Criar perfil operacional
    await testEndpoint(
      '2. Criar perfil operacional (POST)',
      'POST',
      '/api/company/profiles',
      {
        role: 'operational',
        password: 'operacional123',
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Teste 3: Criar perfil financeiro
    await testEndpoint(
      '3. Criar perfil financeiro (POST)',
      'POST',
      '/api/company/profiles',
      {
        role: 'financial',
        password: 'financeiro123',
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Teste 4: Listar perfis novamente
    await testEndpoint(
      '4. Listar perfis novamente (GET)',
      'GET',
      '/api/company/profiles'
    );

    setIsRunning(false);
  };

  return (
    <div className='container mx-auto p-6 max-w-4xl'>
      <Card>
        <CardHeader>
          <CardTitle>🧪 Teste de Endpoints de Perfis</CardTitle>
          <CardDescription>
            Teste os endpoints de gerenciamento de perfis da empresa.
            Você precisa estar logado como empresa para usar esta página.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-2'>
            <Button onClick={runAllTests} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Executando testes...
                </>
              ) : (
                '▶️ Executar Todos os Testes'
              )}
            </Button>
            <Button onClick={clearResults} variant='outline' disabled={isRunning}>
              Limpar Resultados
            </Button>
          </div>

          {results.length > 0 && (
            <div className='space-y-3 mt-6'>
              <h3 className='font-semibold text-lg'>Resultados:</h3>
              {results.map((result, index) => (
                <Alert
                  key={index}
                  variant={result.status === 'success' ? 'default' : 'destructive'}
                >
                  <div className='flex items-start gap-2'>
                    {result.status === 'success' ? (
                      <CheckCircle2 className='h-5 w-5 text-green-600 mt-0.5' />
                    ) : (
                      <XCircle className='h-5 w-5 text-red-600 mt-0.5' />
                    )}
                    <div className='flex-1'>
                      <div className='font-medium'>{result.name}</div>
                      {result.message && (
                        <AlertDescription className='mt-1'>
                          {result.message}
                        </AlertDescription>
                      )}
                      {result.data && (
                        <pre className='mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-40'>
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {results.length === 0 && !isRunning && (
            <Alert>
              <AlertDescription>
                Clique em "Executar Todos os Testes" para começar.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

