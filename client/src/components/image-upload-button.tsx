/**
 * ImageUploadButton - Botão para Upload e Processamento de Imagem
 *
 * Componente que permite ao usuário selecionar uma imagem da galeria
 * ou tirar uma foto usando a câmera, e processa a imagem com OCR.
 *
 * @see OCRParser.ts - Parser de texto extraído
 * @see ocrImageProcessor.ts - Processador de OCR
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, Clipboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processImageOCR, validateImageFile } from '@/utils/ocrImageProcessor';
import { OCRParser } from '@/utils/OCRParser';

interface ImageUploadButtonProps {
  onDataExtracted: (data: {
    cnpj?: string;
    cpf?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    email?: string;
    telefone?: string;
    cep?: string;
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    inscricaoEstadual?: string;
    inscricaoMunicipal?: string;
  }) => void;
  onBeforeProcess?: () => void;
  disabled?: boolean;
}

export function ImageUploadButton({
  onDataExtracted,
  onBeforeProcess,
  disabled,
}: ImageUploadButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pasteEnabled, setPasteEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Valida o arquivo
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: validation.error,
      });
      return;
    }

    await processImage(file);

    // Limpa o input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handler para colar imagem via botão
   */
  const handlePasteButton = async () => {
    if (disabled || isProcessing) return;

    try {
      // Tenta acessar a área de transferência
      const clipboardItems = await navigator.clipboard.read();

      // Procura por imagem nos itens da área de transferência
      for (const item of clipboardItems) {
        // Verifica se é uma imagem
        if (item.types.some((type) => type.startsWith('image/'))) {
          const blob = await item.getType(
            item.types.find((type) => type.startsWith('image/'))!
          );
          if (blob) {
            // Converte Blob para File para validação
            const file = new File([blob], 'pasted-image.png', {
              type: blob.type,
            });
            await processImage(file);
            return;
          }
        }
      }

      // Se não encontrou imagem, mostra mensagem
      toast({
        variant: 'destructive',
        title: 'Aviso',
        description:
          'Nenhuma imagem encontrada na área de transferência. Copie uma imagem primeiro.',
      });
    } catch (error) {
      console.error('Erro ao acessar área de transferência:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description:
          'Não foi possível acessar a área de transferência. Tente usar Ctrl+V ou selecionar um arquivo.',
      });
    }
  };

  /**
   * Processa uma imagem (File ou Blob) com OCR
   */
  const processImage = async (imageFile: File | Blob) => {
    // Limpa os campos antes de processar (se callback fornecido)
    if (onBeforeProcess) {
      onBeforeProcess();
    }

    // Valida o arquivo
    const validation = validateImageFile(imageFile as File);
    if (!validation.valid) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: validation.error,
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Processa a imagem com OCR
      const ocrResult = await processImageOCR(imageFile);

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description:
            'Não foi possível extrair texto da imagem. Tente uma imagem com melhor qualidade.',
        });
        setIsProcessing(false);
        return;
      }

      // DEBUG: Log do texto extraído pelo OCR
      console.log('=== OCR DEBUG ===');
      console.log('Texto completo:', ocrResult.text);
      console.log('Blocos:', ocrResult.blocks);
      console.log('Confiança:', ocrResult.confidence);

      // Processa o texto extraído com o parser
      const parser = new OCRParser();
      const extractedData = parser.parse(ocrResult.blocks);

      // DEBUG: Log dos dados extraídos
      console.log('Dados extraídos:', extractedData);
      console.log('==================');

      // Verifica se algum dado foi extraído
      const hasData = Object.values(extractedData).some(
        (value) => value !== undefined
      );

      if (!hasData) {
        toast({
          variant: 'destructive',
          title: 'Aviso',
          description:
            'Nenhum dado foi identificado na imagem. Verifique se a imagem contém informações legíveis.',
        });
        setIsProcessing(false);
        return;
      }

      // Chama o callback com os dados extraídos
      onDataExtracted(extractedData);

      toast({
        title: 'Sucesso',
        description: `Dados extraídos com ${ocrResult.confidence.toFixed(
          0
        )}% de confiança. Verifique os campos preenchidos.`,
      });
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao processar a imagem. Tente novamente.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handler para colar imagem (CTRL+V)
   */
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      // Só processa se não estiver desabilitado e não estiver processando
      if (disabled || isProcessing || !pasteEnabled) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      // Procura por imagem nos itens colados
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Verifica se é uma imagem
        if (item.type.indexOf('image') !== -1) {
          event.preventDefault(); // Previne comportamento padrão

          const blob = item.getAsFile();
          if (blob) {
            // Converte Blob para File para validação
            const file = new File([blob], 'pasted-image.png', {
              type: blob.type,
            });
            await processImage(file);
          }
          break;
        }
      }
    };

    // Adiciona listener global para paste
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, isProcessing, pasteEnabled]);

  return (
    <div ref={containerRef} className='flex flex-col gap-2'>
      <input
        ref={fileInputRef}
        type='file'
        accept='image/jpeg,image/jpg,image/png,image/webp'
        capture='environment'
        onChange={handleFileSelect}
        className='hidden'
        disabled={disabled || isProcessing}
      />
      <div className='flex gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={handleButtonClick}
          disabled={disabled || isProcessing}
          className='flex-1'
        >
          {isProcessing ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Processando...
            </>
          ) : (
            <>
              <Camera className='mr-2 h-4 w-4' />
              Selecionar Foto
            </>
          )}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={handlePasteButton}
          disabled={disabled || isProcessing}
          className='flex-1'
          title='Colar imagem da área de transferência'
        >
          {isProcessing ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Processando...
            </>
          ) : (
            <>
              <Clipboard className='mr-2 h-4 w-4' />
              Colar Imagem
            </>
          )}
        </Button>
      </div>
      {isProcessing && (
        <p className='text-xs text-muted-foreground text-center'>
          Processando imagem... Isso pode levar alguns segundos.
        </p>
      )}
      <p className='text-xs text-muted-foreground text-center'>
        💡 Dica: Você também pode colar uma imagem com{' '}
        <kbd className='px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'>
          Ctrl+V
        </kbd>
      </p>
    </div>
  );
}
