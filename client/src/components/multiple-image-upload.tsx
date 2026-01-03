/**
 * MultipleImageUpload - Upload e Processamento Múltiplo de Imagens
 *
 * Componente que permite ao usuário selecionar várias imagens e processar
 * cada uma automaticamente, cadastrando clientes automaticamente.
 *
 * @see OCRParser.ts - Parser de texto extraído
 * @see ocrImageProcessor.ts - Processador de OCR
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processImageOCR, validateImageFile } from '@/utils/ocrImageProcessor';
import { OCRParser } from '@/utils/OCRParser';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface ProcessResult {
  fileName: string;
  success: boolean;
  clientName?: string;
  error?: string;
}

interface MultipleImageUploadProps {
  onClientCreated?: (clientData: any) => void;
  onCreateClient: (clientData: any) => Promise<any>;
  disabled?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
  onProcessingFinished?: () => void;
  /**
   * Quando true, esconde o título interno "Upload Múltiplo de Imagens"
   * para permitir que o pai use seu próprio título/descrição.
   */
  hideHeader?: boolean;
  /**
   * Texto opcional para o botão principal de seleção de imagens.
   */
  buttonLabel?: string;
}

export function MultipleImageUpload({
  onClientCreated,
  onCreateClient,
  disabled,
  onProcessingChange,
  onProcessingFinished,
  hideHeader,
  buttonLabel,
}: MultipleImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [results, setResults] = useState<ProcessResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Valida cada arquivo
    const validFiles: File[] = [];
    files.forEach((file) => {
      const validation = validateImageFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else {
        toast({
          variant: 'destructive',
          title: 'Arquivo inválido',
          description: `${file.name}: ${validation.error}`,
        });
      }
    });

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const processAllImages = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    onProcessingChange?.(true);
    setProgress(0);
    setResults([]);
    setCurrentFile('');

    const parser = new OCRParser();
    const newResults: ProcessResult[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setCurrentFile(file.name);
      const currentProgress = ((i + 1) / selectedFiles.length) * 100;
      setProgress(currentProgress);

      try {
        // 1. Processa imagem com OCR
        const ocrResult = await processImageOCR(file);
        const extractedData = parser.parse(ocrResult.blocks);

        // 2. Importa funções de máscara
        const { maskCPF, maskCNPJ, maskPhone, maskCEP } = await import(
          '@/lib/masks'
        );

        // 3. Prepara dados do cliente apenas com OCR (camada base)
        const clientData: any = {
          type: extractedData.cnpj ? 'EMPRESA_PARCEIRA' : 'PF',
          document: extractedData.cnpj
            ? maskCNPJ(extractedData.cnpj)
            : extractedData.cpf
            ? maskCPF(extractedData.cpf)
            : '',
          name: extractedData.nomeFantasia || 'N/C',
          legalName:
            extractedData.razaoSocial || extractedData.nomeFantasia || '',
          email: extractedData.email || '',
          phone: extractedData.telefone
            ? maskPhone(extractedData.telefone)
            : '',
          zipCode: extractedData.cep ? maskCEP(extractedData.cep) : '',
          streetAddress: extractedData.endereco || '',
          addressNumber: extractedData.numero || '',
          neighborhood: extractedData.bairro || '',
          city: extractedData.cidade || '',
          state: extractedData.uf || '',
          municipalRegistration: extractedData.inscricaoMunicipal || '',
          stateRegistration: extractedData.inscricaoEstadual || '',
        };

        // 4. Se tem CNPJ, busca na API primeiro (camada 1: CNPJ)
        let cepFromApisOrOcr: string | null = clientData.zipCode || null;
        if (extractedData.cnpj) {
          try {
            const { fetchCnpjData } = await import('@/services/CnpjService');
            const apiData = await fetchCnpjData(extractedData.cnpj);

            if (apiData) {
              // Prioriza dados da API (sem sobrescrever valores já bons do OCR, apenas campos vazios)
              clientData.legalName =
                apiData.razao_social || clientData.legalName;

              // Se não temos um nome confiável ainda (vazio ou "N/C"), usamos dados da API
              const currentName = (clientData.name || '').trim();
              const fantasia = apiData.nome_fantasia?.trim();
              const razao = apiData.razao_social?.trim();
              if (!currentName || currentName === 'N/C') {
                clientData.name =
                  fantasia || razao || clientData.legalName || 'N/C';
              }

              clientData.zipCode = apiData.cep
                ? maskCEP(apiData.cep)
                : clientData.zipCode;
              clientData.streetAddress =
                clientData.streetAddress || apiData.logradouro || '';
              clientData.addressNumber =
                clientData.addressNumber || apiData.numero || '';
              clientData.neighborhood =
                clientData.neighborhood || apiData.bairro || '';
              clientData.city = clientData.city || apiData.municipio || '';
              clientData.state = clientData.state || apiData.uf || '';
              clientData.phone =
                clientData.phone ||
                (apiData.ddd_telefone_1
                  ? maskPhone(apiData.ddd_telefone_1)
                  : '');
              clientData.email = clientData.email || apiData.email || '';
              clientData.type = 'EMPRESA_PARCEIRA';
              cepFromApisOrOcr = clientData.zipCode || null;
            }
          } catch (error) {
            console.error('Erro ao buscar CNPJ na API:', error);
          }
        }

        // 5. Se tiver CEP (da API ou do OCR), confirma endereço na API de CEP (camada 2: CEP)
        if (cepFromApisOrOcr) {
          const cleanCep = cepFromApisOrOcr.replace(/\D/g, '');
          if (cleanCep.length === 8) {
            try {
              const { fetchCepData } = await import('@/services/CepService');
              const cepInfo = await fetchCepData(cleanCep);
              if (cepInfo) {
                clientData.zipCode = maskCEP(cepInfo.cep || cleanCep);
                clientData.streetAddress =
                  clientData.streetAddress || cepInfo.logradouro || '';
                clientData.neighborhood =
                  clientData.neighborhood || cepInfo.bairro || '';
                clientData.city =
                  clientData.city || cepInfo.city || cepInfo.localidade || '';
                clientData.state =
                  clientData.state || cepInfo.state || cepInfo.uf || '';
              }
            } catch (error) {
              console.error('Erro ao buscar CEP na API:', error);
            }
          }
        }

        // 6. Preenche campos importantes com valores padrão se vazios
        if (!clientData.email) {
          clientData.email = 'sem-email@exemplo.com'; // Email obrigatório no schema
        }
        if (!clientData.phone) {
          clientData.phone = '(00) 00000-0000'; // Telefone obrigatório no schema
        }
        if (!clientData.city) {
          clientData.city = ''; // City obrigatório no schema
        }
        if (!clientData.state) {
          clientData.state = ''; // State obrigatório no schema
        }

        // 7. Cadastra cliente
        const createdClient = await onCreateClient(clientData);

        newResults.push({
          fileName: file.name,
          success: true,
          clientName: createdClient.name || createdClient.legalName,
        });

        if (onClientCreated) {
          onClientCreated(createdClient);
        }
      } catch (error: any) {
        console.error(`Erro ao processar ${file.name}:`, error);
        newResults.push({
          fileName: file.name,
          success: false,
          error: error.message || 'Erro desconhecido',
        });
      }
    }

    setResults(newResults);
    setIsProcessing(false);
    onProcessingChange?.(false);
    onProcessingFinished?.();
    setCurrentFile('');

    // Mostra resumo
    const successCount = newResults.filter((r) => r.success).length;
    const errorCount = newResults.filter((r) => !r.success).length;

    toast({
      title: 'Processamento concluído',
      description: `${successCount} cliente(s) cadastrado(s) com sucesso${
        errorCount > 0 ? `, ${errorCount} erro(s)` : ''
      }.`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });

    // Limpa arquivos após processamento
    setSelectedFiles([]);
  };

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        {!hideHeader && (
          <Label className='text-sm font-medium'>
            Upload Múltiplo de Imagens
          </Label>
        )}
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
          >
            <Upload className='mr-2 h-4 w-4' />
            {buttonLabel || 'Selecionar Imagens'}
          </Button>
          {selectedFiles.length > 0 && (
            <Button
              type='button'
              onClick={processAllImages}
              disabled={disabled || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processando...
                </>
              ) : (
                <>Processar {selectedFiles.length} Imagem(ns)</>
              )}
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          multiple
          onChange={handleFileSelect}
          className='hidden'
        />
        <p className='text-xs text-muted-foreground'>
          Selecione uma ou mais imagens de documentos para cadastrar clientes
          automaticamente.
        </p>
      </div>

      {/* Lista de arquivos selecionados */}
      {selectedFiles.length > 0 && (
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>
            Arquivos selecionados ({selectedFiles.length})
          </Label>
          <div className='space-y-2 max-h-40 overflow-y-auto'>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className='flex items-center justify-between p-2 rounded border'
              >
                <span className='text-sm truncate flex-1'>{file.name}</span>
                {!isProcessing && (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => removeFile(index)}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de progresso */}
      {isProcessing && (
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>
              {currentFile && `Processando: ${currentFile}`}
            </span>
            <span className='font-medium'>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Resultados</Label>
          <div className='space-y-2 max-h-60 overflow-y-auto'>
            {results.map((result, index) => (
              <Card
                key={index}
                className={`p-3 ${
                  result.success
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : 'border-red-500 bg-red-50 dark:bg-red-950'
                }`}
              >
                <div className='flex items-start gap-2'>
                  {result.success ? (
                    <CheckCircle2 className='h-5 w-5 text-green-600 mt-0.5' />
                  ) : (
                    <AlertCircle className='h-5 w-5 text-red-600 mt-0.5' />
                  )}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <span className='text-sm font-medium truncate'>
                        {result.fileName}
                      </span>
                      {result.success && result.clientName && (
                        <Badge variant='outline' className='text-xs'>
                          {result.clientName}
                        </Badge>
                      )}
                    </div>
                    {result.success ? (
                      <p className='text-xs text-green-700 dark:text-green-400'>
                        Cliente cadastrado com sucesso
                      </p>
                    ) : (
                      <p className='text-xs text-red-700 dark:text-red-400'>
                        {result.error}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
