import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCcw,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

type PageInfo = {
  pageIndex: number;
  widthPoints?: number;
  heightPoints?: number;
  widthMm: number;
  heightMm: number;
  previewWidthPx: number;
  previewHeightPx: number;
};

type DetectedField = {
  id: string;
  name: string;
  type: string;
  pageIndex: number;
  source: 'pdf' | 'ocr';
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type OcrLabel = {
  id: string;
  text: string;
  pageIndex: number;
  normalized: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type FieldMapping = {
  componentType: string;
  binding: string;
};

const PREVIEW_TARGET_WIDTH = 720;
const POINTS_TO_MM = 25.4 / 72;
const PX_TO_MM = 25.4 / 96;
const OCR_GAP_PX = 8;
const OCR_MARGIN_PX = 16;
const OCR_MIN_FIELD_WIDTH = 80;
const OCR_MIN_FIELD_HEIGHT = 22;

const bindingOptions = [
  { value: '', label: 'Sem preenchimento' },
  { value: 'ticket.number', label: 'Numero do chamado' },
  { value: 'ticket.description', label: 'Descricao do chamado' },
  { value: 'ticket.date', label: 'Data do chamado' },
  { value: 'ticket.time', label: 'Hora do chamado' },
  { value: 'ticket.scheduledFor', label: 'Data e hora do chamado' },
  { value: 'ticket.address', label: 'Endereco do chamado' },
  { value: 'ticket.city', label: 'Cidade do chamado' },
  { value: 'ticket.state', label: 'Estado do chamado' },
  { value: 'ticket.warranty', label: 'Garantia do chamado' },
  { value: 'client.name', label: 'Nome do cliente' },
  { value: 'client.document', label: 'Documento do cliente' },
  { value: 'client.email', label: 'Email do cliente' },
  { value: 'client.phone', label: 'Telefone do cliente' },
  { value: 'client.address', label: 'Endereco do cliente' },
  { value: 'client.city', label: 'Cidade do cliente' },
  { value: 'client.state', label: 'Estado do cliente' },
  { value: 'client.zipCode', label: 'CEP do cliente' },
  { value: 'client.legalName', label: 'Razao social' },
  { value: 'client.stateRegistration', label: 'Inscricao estadual' },
  { value: 'client.municipalRegistration', label: 'Inscricao municipal' },
  { value: 'company.name', label: 'Nome da empresa' },
  { value: 'company.document', label: 'Documento da empresa' },
  { value: 'company.phone', label: 'Telefone da empresa' },
  { value: 'company.address', label: 'Endereco da empresa' },
  { value: 'company.city', label: 'Cidade da empresa' },
  { value: 'company.state', label: 'Estado da empresa' },
  { value: 'service.name', label: 'Nome do servico' },
  { value: 'service.description', label: 'Descricao do servico' },
];

const suggestComponentType = (fieldType?: string) => {
  if (!fieldType) return 'text';
  if (fieldType === 'Tx') return 'text';
  if (fieldType === 'Btn') return 'checkbox';
  if (fieldType === 'Ch') return 'select';
  if (fieldType === 'Sig') return 'signature';
  return 'text';
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const suggestComponentTypeFromLabel = (label: string) => {
  const normalized = normalizeLabel(label);
  if (normalized.includes('assinatura')) return 'signature';
  if (normalized.includes('data') || normalized.includes('hora')) {
    return 'datetime';
  }
  if (
    normalized.includes('quant') ||
    normalized.includes('qtd') ||
    normalized.includes('numero') ||
    normalized.includes('num')
  ) {
    return 'number';
  }
  if (
    normalized.includes('descricao') ||
    normalized.includes('relato') ||
    normalized.includes('observacao') ||
    normalized.includes('observacoes')
  ) {
    return 'textarea';
  }
  return 'text';
};

const isPdfFile = (file: File) =>
  file.type === 'application/pdf' ||
  file.name.toLowerCase().endsWith('.pdf');

const isImageFile = (file: File) => file.type.startsWith('image/');

const formatMm = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toString().replace('.0', '');
};

export default function RatUploadTeste() {
  const [, setLocation] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [pdfFields, setPdfFields] = useState<DetectedField[]>([]);
  const [ocrFields, setOcrFields] = useState<DetectedField[]>([]);
  const [ocrLabels, setOcrLabels] = useState<OcrLabel[]>([]);
  const [fieldMappings, setFieldMappings] = useState<
    Record<string, FieldMapping>
  >({});
  const [activeMode, setActiveMode] = useState<'pdf' | 'ocr'>('pdf');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>(
    { width: PREVIEW_TARGET_WIDTH, height: 0 }
  );
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [showOcrLabels, setShowOcrLabels] = useState(true);
  const [selectedPage, setSelectedPage] = useState(1);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<any>(null);

  const pageInfoByIndex = useMemo(() => {
    const map = new Map<number, PageInfo>();
    pageInfos.forEach((info) => map.set(info.pageIndex, info));
    return map;
  }, [pageInfos]);

  const activeFields = useMemo(
    () => (activeMode === 'pdf' ? pdfFields : ocrFields),
    [activeMode, pdfFields, ocrFields]
  );

  const fieldsForPage = useMemo(() => {
    return activeFields.filter((field) => field.pageIndex === selectedPage);
  }, [activeFields, selectedPage]);

  const labelsForPage = useMemo(() => {
    if (activeMode !== 'ocr') return [];
    return ocrLabels.filter((label) => label.pageIndex === selectedPage);
  }, [activeMode, ocrLabels, selectedPage]);

  const exportJson = useMemo(() => {
    if (activeFields.length === 0) return '';
    return JSON.stringify(
      activeFields.map((field) => {
        const info = pageInfoByIndex.get(field.pageIndex);
        const widthMm = info ? field.normalized.width * info.widthMm : 0;
        const heightMm = info ? field.normalized.height * info.heightMm : 0;
        const xMm = info ? field.normalized.x * info.widthMm : 0;
        const yMm = info ? field.normalized.y * info.heightMm : 0;
        const mapping = fieldMappings[field.id];
        const defaultComponentType =
          field.source === 'pdf' ? suggestComponentType(field.type) : field.type;
        return {
          name: field.name,
          source: field.source,
          pdfType: field.source === 'pdf' ? field.type : null,
          detectedType: field.type,
          page: field.pageIndex,
          xMm: Math.round(xMm * 10) / 10,
          yMm: Math.round(yMm * 10) / 10,
          widthMm: Math.round(widthMm * 10) / 10,
          heightMm: Math.round(heightMm * 10) / 10,
          componentType: mapping?.componentType || defaultComponentType,
          binding: mapping?.binding || null,
        };
      }),
      null,
      2
    );
  }, [activeFields, fieldMappings, pageInfoByIndex]);

  const resetAll = () => {
    setFile(null);
    setFileType('');
    setIsLoading(false);
    setError('');
    setPageCount(0);
    setPageInfos([]);
    setPdfFields([]);
    setOcrFields([]);
    setOcrLabels([]);
    setFieldMappings({});
    setActiveMode('pdf');
    setPreviewImage(null);
    setPreviewSize({ width: PREVIEW_TARGET_WIDTH, height: 0 });
    setOcrRunning(false);
    setOcrProgress(0);
    setOcrStatus('');
    setShowOcrLabels(true);
    setSelectedPage(1);
    setSelectedFieldId(null);
    setShowExport(false);
    pdfRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateFieldMapping = (fieldId: string, patch: Partial<FieldMapping>) => {
    setFieldMappings((prev) => ({
      ...prev,
      [fieldId]: {
        componentType: prev[fieldId]?.componentType || 'text',
        binding: prev[fieldId]?.binding || '',
        ...patch,
      },
    }));
  };

  const renderPdfPreview = async (pageIndex: number) => {
    if (!pdfRef.current) return;
    const page = await pdfRef.current.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    const scale = PREVIEW_TARGET_WIDTH / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.width = Math.round(scaledViewport.width);
    canvas.height = Math.round(scaledViewport.height);
    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    setPreviewImage(canvas.toDataURL('image/png'));
    setPreviewSize({ width: canvas.width, height: canvas.height });
  };

  const readFileAsDataUrl = (inputFile: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(inputFile);
    });

  const loadImagePreview = async (dataUrl: string) => {
    const image = new Image();
    image.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    });
    const scale = PREVIEW_TARGET_WIDTH / image.width;
    const previewWidth = Math.round(image.width * scale);
    const previewHeight = Math.round(image.height * scale);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Falha ao gerar preview.');
    }
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    context.drawImage(image, 0, 0, previewWidth, previewHeight);
    setPreviewImage(canvas.toDataURL('image/png'));
    setPreviewSize({ width: previewWidth, height: previewHeight });
    return {
      originalWidth: image.width,
      originalHeight: image.height,
      previewWidth,
      previewHeight,
    };
  };

  const analyzeFile = async () => {
    if (!file) return;
    setIsLoading(true);
    setError('');
    setPageInfos([]);
    setPageCount(0);
    setPdfFields([]);
    setOcrFields([]);
    setOcrLabels([]);
    setFieldMappings({});
    setActiveMode('pdf');
    setShowExport(false);
    setSelectedFieldId(null);

    try {
      if (isPdfFile(file)) {
        setFileType('pdf');
        const data = new Uint8Array(await file.arrayBuffer());
        const loadingTask = getDocument({ data });
        const pdf = await loadingTask.promise;
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);

        const nextFields: DetectedField[] = [];
        const nextPages: PageInfo[] = [];

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex);
          const viewport = page.getViewport({ scale: 1 });
          const previewScale = PREVIEW_TARGET_WIDTH / viewport.width;
          const previewWidthPx = Math.round(viewport.width * previewScale);
          const previewHeightPx = Math.round(viewport.height * previewScale);

          nextPages.push({
            pageIndex,
            widthPoints: viewport.width,
            heightPoints: viewport.height,
            widthMm: viewport.width * POINTS_TO_MM,
            heightMm: viewport.height * POINTS_TO_MM,
            previewWidthPx,
            previewHeightPx,
          });

          const annotations = await page.getAnnotations({ intent: 'display' });
          annotations.forEach((annotation: any, index: number) => {
            if (annotation.subtype !== 'Widget') return;
            const rect = annotation.rect as number[] | undefined;
            if (!rect || rect.length < 4) return;
            const [x1, y1, x2, y2] = rect;
            const width = Math.max(0, x2 - x1);
            const height = Math.max(0, y2 - y1);
            if (!width || !height) return;
            const x = x1;
            const y = viewport.height - y2;

            nextFields.push({
              id: `${pageIndex}-${index}-${annotation.fieldName || 'field'}`,
              name:
                annotation.fieldName ||
                annotation.alternativeText ||
                `Campo ${nextFields.length + 1}`,
              type: annotation.fieldType || annotation.subtype || 'Widget',
              pageIndex,
              source: 'pdf',
              normalized: {
                x: x / viewport.width,
                y: y / viewport.height,
                width: width / viewport.width,
                height: height / viewport.height,
              },
            });
          });
        }

        setPdfFields(nextFields);
        setPageInfos(nextPages);
        setSelectedPage(1);
        setActiveMode(nextFields.length > 0 ? 'pdf' : 'ocr');

        const nextMappings: Record<string, FieldMapping> = {};
        nextFields.forEach((field) => {
          nextMappings[field.id] = {
            componentType: suggestComponentType(field.type),
            binding: '',
          };
        });
        setFieldMappings(nextMappings);

        await renderPdfPreview(1);
      } else if (isImageFile(file)) {
        setFileType('image');
        pdfRef.current = null;
        const dataUrl = await readFileAsDataUrl(file);
        const { originalWidth, originalHeight, previewWidth, previewHeight } =
          await loadImagePreview(dataUrl);

        setPageCount(1);
        setPageInfos([
          {
            pageIndex: 1,
            widthMm: originalWidth * PX_TO_MM,
            heightMm: originalHeight * PX_TO_MM,
            previewWidthPx: previewWidth,
            previewHeightPx: previewHeight,
          },
        ]);
        setSelectedPage(1);
        setActiveMode('ocr');
      } else {
        setError('Formato nao suportado. Envie PDF ou imagem.');
        pdfRef.current = null;
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar o arquivo.');
      pdfRef.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  const runOcr = async () => {
    if (!previewImage) {
      setError('Carregue um arquivo antes de rodar o OCR.');
      return;
    }

    setOcrRunning(true);
    setOcrProgress(0);
    setOcrStatus('');
    setError('');

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker({
        logger: (message: any) => {
          if (message?.status) {
            setOcrStatus(message.status);
          }
          if (typeof message?.progress === 'number') {
            setOcrProgress(message.progress);
          }
        },
      });

      try {
        let lang = 'por';
        try {
          await worker.loadLanguage(lang);
          await worker.initialize(lang);
        } catch {
          lang = 'eng';
          await worker.loadLanguage(lang);
          await worker.initialize(lang);
        }
        const result = await worker.recognize(previewImage);
        const lines = result.data?.lines || [];
        const imageWidth =
          previewSize.width || result.data?.imageSize?.width || 1;
        const imageHeight =
          previewSize.height || result.data?.imageSize?.height || 1;

        const lineItems = lines
          .map((line: any, index: number) => {
            const text = String(line.text || '').trim();
            const bbox = line.bbox;
            if (!bbox || text.length < 2) return null;
            return {
              id: `${selectedPage}-line-${index}`,
              text,
              bbox: {
                x0: bbox.x0,
                y0: bbox.y0,
                x1: bbox.x1,
                y1: bbox.y1,
              },
            };
          })
          .filter(Boolean) as Array<{
          id: string;
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }>;

        const nextLabels: OcrLabel[] = lineItems.map((line) => ({
          id: `label-${line.id}`,
          text: line.text,
          pageIndex: selectedPage,
          normalized: {
            x: line.bbox.x0 / imageWidth,
            y: line.bbox.y0 / imageHeight,
            width: (line.bbox.x1 - line.bbox.x0) / imageWidth,
            height: (line.bbox.y1 - line.bbox.y0) / imageHeight,
          },
        }));

        const overlapsRow = (
          a: { y0: number; y1: number },
          b: { y0: number; y1: number }
        ) => {
          const top = Math.max(a.y0, b.y0);
          const bottom = Math.min(a.y1, b.y1);
          const overlap = bottom - top;
          return overlap > 0;
        };

        const nextFields: DetectedField[] = [];

        lineItems.forEach((line, index) => {
          const hasColon = line.text.includes(':');
          const hasUnderline = /_{3,}/.test(line.text);
          if (!hasColon && !hasUnderline) return;

          const lineHeight = line.bbox.y1 - line.bbox.y0;
          const inputHeight = Math.max(OCR_MIN_FIELD_HEIGHT, lineHeight + 6);
          const inputTop = Math.max(0, line.bbox.y0 - 2);

          if (hasUnderline && !hasColon) {
            const labelAbove = lineItems
              .filter((item) => item.bbox.y1 <= line.bbox.y0)
              .filter((item) => Math.abs(item.bbox.x0 - line.bbox.x0) < 40)
              .sort((a, b) => b.bbox.y1 - a.bbox.y1)[0];
            const labelText = labelAbove?.text || '';
            const inputWidth = Math.max(
              OCR_MIN_FIELD_WIDTH,
              line.bbox.x1 - line.bbox.x0
            );

            nextFields.push({
              id: `ocr-${selectedPage}-${index}`,
              name: labelText || `Campo ${nextFields.length + 1}`,
              type: suggestComponentTypeFromLabel(labelText || line.text),
              pageIndex: selectedPage,
              source: 'ocr',
              normalized: {
                x: line.bbox.x0 / imageWidth,
                y: inputTop / imageHeight,
                width: inputWidth / imageWidth,
                height: inputHeight / imageHeight,
              },
            });
            return;
          }

          if (hasColon) {
            const sameRow = lineItems.filter(
              (item) =>
                item.id !== line.id &&
                overlapsRow(item.bbox, line.bbox) &&
                item.bbox.x0 > line.bbox.x0
            );
            const rightBoundary =
              sameRow.length > 0
                ? Math.min(...sameRow.map((item) => item.bbox.x0)) - OCR_GAP_PX
                : imageWidth - OCR_MARGIN_PX;
            const inputLeft = line.bbox.x1 + OCR_GAP_PX;
            const inputWidth = rightBoundary - inputLeft;
            if (inputWidth < OCR_MIN_FIELD_WIDTH) return;
            const labelText = line.text.replace(/\s*:\s*$/, '').trim();

            nextFields.push({
              id: `ocr-${selectedPage}-${index}`,
              name: labelText || `Campo ${nextFields.length + 1}`,
              type: suggestComponentTypeFromLabel(labelText || line.text),
              pageIndex: selectedPage,
              source: 'ocr',
              normalized: {
                x: inputLeft / imageWidth,
                y: inputTop / imageHeight,
                width: inputWidth / imageWidth,
                height: inputHeight / imageHeight,
              },
            });
          }
        });

        setOcrLabels((prev) => [
          ...prev.filter((label) => label.pageIndex !== selectedPage),
          ...nextLabels,
        ]);
        setOcrFields((prev) => [
          ...prev.filter((field) => field.pageIndex !== selectedPage),
          ...nextFields,
        ]);

        setFieldMappings((prev) => {
          const next = { ...prev };
          nextFields.forEach((field) => {
            if (!next[field.id]) {
              next[field.id] = {
                componentType: field.type,
                binding: '',
              };
            }
          });
          return next;
        });

        setActiveMode('ocr');
        setSelectedFieldId(nextFields[0]?.id || null);
      } finally {
        await worker.terminate();
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao executar OCR.');
    } finally {
      setOcrRunning(false);
    }
  };

  useEffect(() => {
    if (pdfRef.current && fileType === 'pdf') {
      renderPdfPreview(selectedPage).catch(() => {});
    }
  }, [fileType, selectedPage]);

  useEffect(() => {
    if (
      selectedFieldId &&
      !activeFields.some((field) => field.id === selectedFieldId)
    ) {
      setSelectedFieldId(null);
    }
  }, [activeFields, selectedFieldId]);

  const currentPageInfo = pageInfoByIndex.get(selectedPage);
  const isA4 =
    !!currentPageInfo &&
    ((Math.abs(currentPageInfo.widthMm - 210) <= 2 &&
      Math.abs(currentPageInfo.heightMm - 297) <= 2) ||
      (Math.abs(currentPageInfo.widthMm - 297) <= 2 &&
        Math.abs(currentPageInfo.heightMm - 210) <= 2));

  return (
    <div className='min-h-screen bg-[#f5f7f8] dark:bg-[#101722] px-6 py-6'>
      <div className='mx-auto max-w-6xl space-y-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold text-[#111418] dark:text-white'>
              Laboratorio de Upload RAT (Teste)
            </h1>
            <p className='text-sm text-[#60708a] dark:text-gray-400'>
              Envie PDF ou imagem para testar OCR e sugestao de campos.
            </p>
          </div>
          <Button
            type='button'
            variant='outline'
            onClick={() => setLocation('/editor-ordem-servico')}
          >
            <ArrowLeft className='mr-2 h-4 w-4' />
            Voltar ao editor
          </Button>
        </div>

        <Card className='p-6 space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex-1 min-w-[240px]'>
              <Label htmlFor='pdfUpload'>Arquivo PDF ou imagem</Label>
              <Input
                ref={fileInputRef}
                id='pdfUpload'
                type='file'
                accept='application/pdf,image/*'
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setFile(nextFile);
                  setError('');
                  setFileType('');
                  setPageInfos([]);
                  setPageCount(0);
                  setPdfFields([]);
                  setOcrFields([]);
                  setOcrLabels([]);
                  setFieldMappings({});
                  setActiveMode('pdf');
                  setPreviewImage(null);
                  setPreviewSize({ width: PREVIEW_TARGET_WIDTH, height: 0 });
                  setSelectedPage(1);
                  setSelectedFieldId(null);
                  setShowExport(false);
                }}
                className='mt-1'
              />
              <p className='mt-2 text-xs text-[#60708a] dark:text-gray-400'>
                PDF editavel detecta campos. Para imagem/PDF sem campos, use OCR.
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                onClick={analyzeFile}
                disabled={!file || isLoading}
              >
                {isLoading ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Upload className='mr-2 h-4 w-4' />
                )}
                Carregar arquivo
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={runOcr}
                disabled={!previewImage || isLoading || ocrRunning}
              >
                {ocrRunning ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <FileText className='mr-2 h-4 w-4' />
                )}
                Detectar campos (OCR)
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={resetAll}
                disabled={isLoading}
              >
                <RefreshCcw className='mr-2 h-4 w-4' />
                Limpar
              </Button>
            </div>
          </div>

          {error && (
            <div className='flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
              <TriangleAlert className='mt-0.5 h-4 w-4' />
              <span>{error}</span>
            </div>
          )}

          {ocrRunning && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs text-[#60708a] dark:text-gray-400'>
                <span>OCR em andamento {ocrStatus ? `- ${ocrStatus}` : ''}</span>
                <span>{Math.round(ocrProgress * 100)}%</span>
              </div>
              <div className='h-2 w-full rounded-full bg-slate-200'>
                <div
                  className='h-2 rounded-full bg-[#3880f5] transition-all'
                  style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {file && (
            <div className='flex flex-wrap gap-4 text-sm text-[#60708a] dark:text-gray-400'>
              <div className='flex items-center gap-2'>
                <FileText className='h-4 w-4' />
                <span>{file.name}</span>
              </div>
              <span>{Math.round(file.size / 1024)} KB</span>
              {pageCount > 0 && <span>{pageCount} pagina(s)</span>}
            </div>
          )}
        </Card>

        {pageInfos.length > 0 && (
          <Card className='p-6 space-y-4'>
            <div className='flex flex-wrap items-center gap-4'>
              <div className='flex items-center gap-2 text-sm'>
                <span className='font-medium text-[#111418] dark:text-white'>
                  Tamanho documento:
                </span>
                <span className='text-[#60708a] dark:text-gray-400'>
                  {formatMm(currentPageInfo?.widthMm || 0)} x{' '}
                  {formatMm(currentPageInfo?.heightMm || 0)} mm
                </span>
              </div>
              <div className='flex items-center gap-2 text-sm'>
                {isA4 ? (
                  <>
                    <CheckCircle2 className='h-4 w-4 text-emerald-500' />
                    <span className='text-emerald-600'>A4 detectado</span>
                  </>
                ) : (
                  <>
                    <TriangleAlert className='h-4 w-4 text-amber-500' />
                    <span className='text-amber-700'>Nao e A4</span>
                  </>
                )}
              </div>
              <div className='flex items-center gap-2 text-sm text-[#60708a] dark:text-gray-400'>
                <span>Campos PDF:</span>
                <strong className='text-[#111418] dark:text-white'>
                  {pdfFields.length}
                </strong>
              </div>
              <div className='flex items-center gap-2 text-sm text-[#60708a] dark:text-gray-400'>
                <span>Campos OCR:</span>
                <strong className='text-[#111418] dark:text-white'>
                  {ocrFields.length}
                </strong>
              </div>
              <div className='flex items-center gap-2 text-sm text-[#60708a] dark:text-gray-400'>
                <span>Modo:</span>
                <strong className='text-[#111418] dark:text-white'>
                  {activeMode === 'pdf' ? 'Formulario' : 'OCR'}
                </strong>
              </div>
            </div>
          </Card>
        )}

        {pageInfos.length > 0 && (
          <div className='grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'>
            <Card className='p-6 space-y-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h2 className='text-sm font-semibold text-[#111418] dark:text-white'>
                    Preview + campos detectados
                  </h2>
                  <p className='text-xs text-[#60708a] dark:text-gray-400'>
                    Clique em um campo para ver o destaque na lista.
                  </p>
                </div>
                <div className='flex flex-wrap items-center gap-3'>
                  {pageCount > 1 && (
                    <div className='flex items-center gap-2 text-sm'>
                      <Label htmlFor='pageSelect'>Pagina</Label>
                      <select
                        id='pageSelect'
                        value={selectedPage}
                        onChange={(event) =>
                          setSelectedPage(Number(event.target.value))
                        }
                        className='rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700'
                      >
                        {Array.from({ length: pageCount }, (_, index) => (
                          <option key={index + 1} value={index + 1}>
                            {index + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className='flex items-center gap-2 text-xs'>
                    {pdfFields.length > 0 && (
                      <button
                        type='button'
                        onClick={() => setActiveMode('pdf')}
                        className={`rounded-full border px-3 py-1 ${
                          activeMode === 'pdf'
                            ? 'border-[#3880f5] bg-[#3880f5] text-white'
                            : 'border-gray-200 bg-white text-gray-600'
                        }`}
                      >
                        Formulario
                      </button>
                    )}
                    {ocrFields.length > 0 && (
                      <button
                        type='button'
                        onClick={() => setActiveMode('ocr')}
                        className={`rounded-full border px-3 py-1 ${
                          activeMode === 'ocr'
                            ? 'border-[#3880f5] bg-[#3880f5] text-white'
                            : 'border-gray-200 bg-white text-gray-600'
                        }`}
                      >
                        OCR
                      </button>
                    )}
                  </div>
                  {activeMode === 'ocr' && (
                    <label className='flex items-center gap-2 text-xs text-[#60708a]'>
                      <input
                        type='checkbox'
                        checked={showOcrLabels}
                        onChange={(event) =>
                          setShowOcrLabels(event.target.checked)
                        }
                      />
                      Mostrar labels OCR
                    </label>
                  )}
                </div>
              </div>

              <div className='relative rounded-lg border border-dashed border-slate-200 bg-white p-4 overflow-auto'>
                <div
                  className='relative mx-auto border border-slate-200 shadow-sm'
                  style={{
                    width: previewSize.width,
                    height: previewSize.height || 100,
                    backgroundImage: previewImage
                      ? `url(${previewImage})`
                      : undefined,
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'top left',
                  }}
                >
                  {activeMode === 'ocr' &&
                    showOcrLabels &&
                    labelsForPage.map((label) => {
                      const left = label.normalized.x * previewSize.width;
                      const top = label.normalized.y * previewSize.height;
                      const width = label.normalized.width * previewSize.width;
                      const height = label.normalized.height * previewSize.height;
                      return (
                        <div
                          key={label.id}
                        className='absolute text-[9px] px-1 text-slate-700'
                        style={{
                          left,
                          top,
                          width: Math.max(width, 8),
                          height: Math.max(height, 8),
                          backgroundColor: 'rgba(255,255,255,0.65)',
                          border: '1px dashed rgba(148,163,184,0.8)',
                          pointerEvents: 'none',
                        }}
                      >
                          {label.text}
                        </div>
                      );
                    })}
                  {fieldsForPage.map((field) => {
                    const left = field.normalized.x * previewSize.width;
                    const top = field.normalized.y * previewSize.height;
                    const width = field.normalized.width * previewSize.width;
                    const height = field.normalized.height * previewSize.height;
                    const isSelected = selectedFieldId === field.id;
                    const baseStyle =
                      field.source === 'ocr'
                        ? 'border border-amber-400 bg-amber-50/70'
                        : 'border border-emerald-400 bg-emerald-50/70';
                    return (
                      <button
                        key={field.id}
                        type='button'
                        onClick={() => setSelectedFieldId(field.id)}
                        title={field.name}
                        className={`absolute text-[10px] text-left px-1 ${
                          isSelected
                            ? 'border-2 border-[#3880f5] bg-blue-50/70'
                            : baseStyle
                        }`}
                        style={{
                          left,
                          top,
                          width: Math.max(width, 8),
                          height: Math.max(height, 8),
                        }}
                      >
                        {field.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className='p-6 space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h2 className='text-sm font-semibold text-[#111418] dark:text-white'>
                    Campos e mapeamento ({activeMode === 'pdf' ? 'Formulario' : 'OCR'})
                  </h2>
                  <p className='text-xs text-[#60708a] dark:text-gray-400'>
                    // Ajuste o tipo e vinculo para cada campo detectado.
                  </p>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setShowExport((prev) => !prev)}
                  disabled={activeFields.length === 0}
                >
                  {showExport ? 'Ocultar JSON' : 'Exportar JSON'}
                </Button>
              </div>

              {fieldsForPage.length === 0 ? (
                <div className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700'>
                  {activeMode === 'pdf'
                    ? 'Nenhum campo de formulario detectado nesta pagina. Rode o OCR.'
                    : 'Nenhum campo OCR detectado nesta pagina. Ajuste a pagina ou o arquivo.'}
                </div>
              ) : (
                <div className='space-y-3'>
                  {fieldsForPage.map((field) => {
                    const mapping = fieldMappings[field.id];
                    const info = pageInfoByIndex.get(field.pageIndex);
                    const xMm = info ? field.normalized.x * info.widthMm : 0;
                    const yMm = info ? field.normalized.y * info.heightMm : 0;
                    const wMm = info ? field.normalized.width * info.widthMm : 0;
                    const hMm = info ? field.normalized.height * info.heightMm : 0;
                    return (
                      <div
                        key={field.id}
                        className={`rounded-lg border p-3 ${
                          selectedFieldId === field.id
                            ? 'border-[#3880f5] bg-blue-50/60'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className='flex items-center justify-between gap-2'>
                          <div>
                            <p className='text-sm font-semibold text-[#111418]'>
                              {field.name}
                            </p>
                            <p className='text-xs text-[#60708a]'>
                              Origem: {field.source.toUpperCase()} | Tipo:{' '}
                              {field.type} | Posicao:{' '}
                              {formatMm(xMm)} x {formatMm(yMm)} mm | Tam:{' '}
                              {formatMm(wMm)} x {formatMm(hMm)} mm
                            </p>
                          </div>
                        </div>
                        <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                          <div>
                            <Label className='text-xs'>Tipo de componente</Label>
                            <select
                              value={mapping?.componentType || 'text'}
                              onChange={(event) =>
                                updateFieldMapping(field.id, {
                                  componentType: event.target.value,
                                })
                              }
                              className='mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm'
                            >
                              <option value='text'>Campo de texto</option>
                              <option value='number'>Numero</option>
                              <option value='datetime'>Data/hora</option>
                              <option value='select'>Lista suspensa</option>
                              <option value='checkbox'>Checkbox</option>
                              <option value='textarea'>Area de texto</option>
                              <option value='signature'>Assinatura</option>
                              <option value='text-block'>Texto livre</option>
                            </select>
                          </div>
                          <div>
                            <Label className='text-xs'>Vincular dados</Label>
                            <select
                              value={mapping?.binding || ''}
                              onChange={(event) =>
                                updateFieldMapping(field.id, {
                                  binding: event.target.value,
                                })
                              }
                              className='mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm'
                            >
                              {bindingOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showExport && exportJson && (
                <div>
                  <Label className='text-xs'>JSON sugerido</Label>
                  <Textarea
                    value={exportJson}
                    readOnly
                    rows={12}
                    className='mt-1 text-xs font-mono'
                  />
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
