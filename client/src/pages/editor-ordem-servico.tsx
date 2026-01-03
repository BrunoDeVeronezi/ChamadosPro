import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { usePaidAccess } from '@/hooks/use-paid-access';
import {
  Type,
  Hash,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Image,
  Minus,
  Table as TableIcon,
  PenTool,
  AlignLeft,
  Eye,
  Save,
  Send,
  Trash2,
  GripVertical,
  RotateCw,
  X,
  FileText,
  Upload,
  Loader2,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  getDocument,
  GlobalWorkerOptions,
  VerbosityLevel,
} from 'pdfjs-dist/legacy/build/pdf';
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

type LayoutMode = 'free' | 'flow';

type TemplateBackground = {
  url: string;
  name?: string;
};

const FIELD_COMPONENT_TYPES = [
  'text',
  'number',
  'datetime',
  'select',
  'textarea',
  'checkbox',
];

interface FormComponent {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  showInput?: boolean;
  logoUrl?: string;
  logoAssetId?: string;
  options?: string[]; // Para select
  rows?: number; // Para textarea
  defaultValue?: string;
  binding?: string;
  width?: string;
  height?: string;
  x?: number;
  y?: number;
  page?: number;
  rotation?: number;
}

type TemplatePayload = {
  layoutMode: LayoutMode;
  pageCount: number;
  backgrounds: Array<TemplateBackground | null>;
  components: FormComponent[];
};

type ServiceOrderTemplate = {
  id: string;
  name: string;
  template: TemplatePayload;
  clientId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PartnerClient = {
  id: string;
  name: string;
  type: string;
  ratTemplateId?: string | null;
};

type ConfirmDialogAction = 'load' | 'delete' | 'publish' | 'draft';

export default function EditorOrdemServico() {
  const { toast } = useToast();
  const { requirePaid } = usePaidAccess();
  const [templateName, setTemplateName] = useState(
    'Template Padrão de Instalação'
  );
  const [components, setComponents] = useState<FormComponent[]>([]);
  const [selectedComponent, setSelectedComponent] =
    useState<FormComponent | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(
    null
  );
  const [draggedComponent, setDraggedComponent] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragHandlePositions, setDragHandlePositions] = useState<
    Record<string, { x: number; y: number; clamped: boolean }>
  >({});
  const [showPreview, setShowPreview] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('free');
  const [backgrounds, setBackgrounds] = useState<
    Array<TemplateBackground | null>
  >([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [templateScope, setTemplateScope] = useState<
    'client' | 'avulsa' | ''
  >('');
  const [selectedPartnerClientId, setSelectedPartnerClientId] = useState('');
  const [templateFilterClientId, setTemplateFilterClientId] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    action: ConfirmDialogAction;
    template?: ServiceOrderTemplate;
    trimmedName?: string;
  } | null>(null);
  const designAreaRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const componentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const resizingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const draggingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const rotatingRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    startRotation: number;
  } | null>(null);

  const MIN_COMPONENT_WIDTH = 80;
  const MIN_COMPONENT_HEIGHT = 40;
  const DEFAULT_COMPONENT_WIDTH = 280;
  const DEFAULT_COMPONENT_HEIGHT = 72;
  const COMPONENT_GAP = 16;
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 10;
  const MM_TO_PX = 96 / 25.4;
  const pageWidthPx = Math.round(A4_WIDTH_MM * MM_TO_PX);
  const pageHeightPx = Math.round(A4_HEIGHT_MM * MM_TO_PX);
  const pageMarginPx = Math.round(PAGE_MARGIN_MM * MM_TO_PX);
  const contentWidthPx = pageWidthPx;
  const contentHeightPx = pageHeightPx;
  const pageWidthMm = `${A4_WIDTH_MM}mm`;
  const pageHeightMm = `${A4_HEIGHT_MM}mm`;
  const pageMarginMm = `${PAGE_MARGIN_MM}mm`;
  const pageWidthCss = `${pageWidthPx}px`;
  const pageHeightCss = `${pageHeightPx}px`;
  const pageMarginCss = `${pageMarginPx}px`;
  const pageCount = Math.max(1, backgrounds.length);
  const currentBackground = backgrounds[currentPage] || null;
  const hasBackground = backgrounds.some((background) => background?.url);

  const normalizeSizeValue = (value: string, fallback?: string) => {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (/^\d+$/.test(trimmed)) {
      return `${trimmed}px`;
    }
    return trimmed;
  };

  const parseSizePx = (
    value: string | undefined,
    fallback: number,
    base?: number
  ) => {
    if (!value) return fallback;
    const trimmed = value.trim();
    const plainNumber = Number.parseFloat(trimmed);
    if (
      trimmed.endsWith('px') ||
      (/^\d+(\.\d+)?$/.test(trimmed) && Number.isFinite(plainNumber))
    ) {
      return Number.isFinite(plainNumber) ? plainNumber : fallback;
    }
    if (base && trimmed.endsWith('%')) {
      const percent = Number.parseFloat(trimmed);
      if (Number.isFinite(percent)) {
        return (base * percent) / 100;
      }
    }
    if (base) {
      const calcMatch = trimmed.match(
        /^calc\(([\d.]+)%\s*-\s*([\d.]+)px\)$/
      );
      if (calcMatch) {
        const percent = Number.parseFloat(calcMatch[1]);
        const px = Number.parseFloat(calcMatch[2]);
        if (Number.isFinite(percent) && Number.isFinite(px)) {
          return (base * percent) / 100 - px;
        }
      }
    }
    return fallback;
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao ler o arquivo.'));
        }
      };
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });

  const uploadBackgroundDataUrl = async (dataUrl: string, fileName: string) => {
    const response = await apiRequest(
      'POST',
      '/api/service-order-templates/backgrounds',
      {
        dataUrl,
        fileName,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erro ao enviar modelo.');
    }
    const payload = await response.json();
    return { url: payload.url, name: fileName };
  };

  const uploadLogoDataUrl = async (
    dataUrl: string,
    fileName: string,
    componentId: string
  ) => {
    const response = await apiRequest(
      'POST',
      '/api/service-order-templates/logos',
      {
        dataUrl,
        fileName,
        componentId,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Erro ao enviar logo.');
    }
    const payload = await response.json();
    return { url: payload.url, assetId: payload.assetId };
  };

  const getComponentDefaultHeight = (type: string) => {
    switch (type) {
      case 'textarea':
        return 160;
      case 'table':
        return 180;
      case 'logo':
        return 120;
      case 'signature':
        return 140;
      case 'divider':
        return 24;
      case 'text-block':
        return 56;
      default:
        return DEFAULT_COMPONENT_HEIGHT;
    }
  };

  const getComponentDefaultWidth = (type: string) => {
    switch (type) {
      case 'divider':
      case 'table':
      case 'text-block':
        return '100%';
      case 'logo':
        return '160px';
      default:
        return `${DEFAULT_COMPONENT_WIDTH}px`;
    }
  };

  const getNextComponentPosition = (
    pageIndex: number,
    widthPx: number,
    heightPx: number
  ) => {
    const pageComponents = components.filter(
      (component) => (component.page ?? 0) === pageIndex
    );
    if (pageComponents.length === 0) {
      return { x: 0, y: 0 };
    }
    const maxBottom = pageComponents.reduce((max, component) => {
      const compHeight = parseSizePx(
        component.height,
        getComponentDefaultHeight(component.type),
        contentHeightPx
      );
      const compY = component.y ?? 0;
      return Math.max(max, compY + compHeight);
    }, 0);

    return {
      x: 0,
      y: maxBottom + COMPONENT_GAP,
    };
  };

  const maxComponentPage = useMemo(() => {
    return components.reduce(
      (max, component) => Math.max(max, component.page ?? 0),
      0
    );
  }, [components]);

  const componentsForPage = useMemo(() => {
    return components.filter(
      (component) => (component.page ?? 0) === currentPage
    );
  }, [components, currentPage]);
  const componentIndexById = useMemo(() => {
    return new Map(components.map((component, index) => [component.id, index]));
  }, [components]);

  useLayoutEffect(() => {
    if (layoutMode !== 'free') {
      setDragHandlePositions((prev) =>
        Object.keys(prev).length > 0 ? {} : prev
      );
      return;
    }

    const contentRect = contentAreaRef.current?.getBoundingClientRect();
    if (!contentRect) return;

    const handleSize = 24;
    const padding = 6;
    const nextPositions: Record<
      string,
      { x: number; y: number; clamped: boolean }
    > = {};

    componentsForPage.forEach((component) => {
      const node = componentRefs.current[component.id];
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const desiredX = rect.left - contentRect.left + padding;
      const desiredY = rect.top - contentRect.top + padding;
      const maxX = Math.max(padding, contentRect.width - handleSize - padding);
      const maxY = Math.max(padding, contentRect.height - handleSize - padding);
      const clampedX = Math.min(Math.max(desiredX, padding), maxX);
      const clampedY = Math.min(Math.max(desiredY, padding), maxY);
      const clamped =
        Math.round(desiredX) !== Math.round(clampedX) ||
        Math.round(desiredY) !== Math.round(clampedY);

      nextPositions[component.id] = {
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        clamped,
      };
    });

    setDragHandlePositions((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(nextPositions);
      if (prevKeys.length !== nextKeys.length) {
        return nextPositions;
      }
      for (const key of nextKeys) {
        const prevPos = prev[key];
        const nextPos = nextPositions[key];
        if (
          !prevPos ||
          prevPos.x !== nextPos.x ||
          prevPos.y !== nextPos.y ||
          prevPos.clamped !== nextPos.clamped
        ) {
          return nextPositions;
        }
      }
      return prev;
    });
  }, [componentsForPage, layoutMode]);

  useEffect(() => {
    if (maxComponentPage + 1 > backgrounds.length) {
      setBackgrounds((prev) => {
        const next = [...prev];
        while (next.length < maxComponentPage + 1) {
          next.push(null);
        }
        return next;
      });
    }
  }, [backgrounds.length, maxComponentPage]);

  useEffect(() => {
    if (currentPage > pageCount - 1) {
      setCurrentPage(pageCount - 1);
    }
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (selectedComponent && (selectedComponent.page ?? 0) !== currentPage) {
      setSelectedComponent(null);
    }
  }, [currentPage, selectedComponent]);

  const { data: partnerClients = [] } = useQuery<PartnerClient[]>({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/clients', undefined);
      if (!response.ok) {
        throw new Error('Erro ao carregar clientes');
      }
      const payload = await response.json();
      return Array.isArray(payload)
        ? payload.filter((client) => client?.type === 'EMPRESA_PARCEIRA')
        : [];
    },
  });

  useEffect(() => {
    if (templateScope !== 'client' || !selectedPartnerClientId) return;
    setTemplateFilterClientId((prev) =>
      prev ? prev : selectedPartnerClientId
    );
  }, [selectedPartnerClientId, templateScope]);

  const { data: savedTemplates = [], isLoading: isLoadingTemplates } = useQuery<
    ServiceOrderTemplate[]
  >({
    queryKey: ['/api/service-order-templates'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/service-order-templates',
        undefined
      );
      if (!response.ok) {
        throw new Error('Erro ao carregar templates');
      }
      return response.json();
    },
  });

  const filteredTemplates = useMemo(() => {
    if (!templateFilterClientId) return savedTemplates;
    if (templateFilterClientId === 'avulsa') {
      return savedTemplates.filter((template) => !template.clientId);
    }
    return savedTemplates.filter(
      (template) => template.clientId === templateFilterClientId
    );
  }, [savedTemplates, templateFilterClientId]);

  const saveDraftMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      template: TemplatePayload;
      clientId?: string;
      templateId?: string | null;
    }) => {
      const response = await apiRequest(
        'POST',
        '/api/service-order-templates/draft',
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar rascunho');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Rascunho salvo',
        description: 'O rascunho foi salvo com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar rascunho',
        description: error.message,
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      template: TemplatePayload;
      clientId?: string;
      templateId?: string | null;
    }) => {
      const response = await apiRequest(
        'POST',
        '/api/service-order-templates',
        data
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/service-order-templates'],
      });
      toast({
        title: 'Template salvo',
        description: 'O template foi salvo com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar template',
        description: error.message,
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest(
        'DELETE',
        `/api/service-order-templates/${templateId}`,
        undefined
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Erro ao excluir template');
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/service-order-templates'],
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir template',
        description: error.message,
      });
    },
  });

  const getDefaultLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Campo de Texto',
      number: 'Campo Numérico',
      datetime: 'Data/Hora',
      checkbox: 'Caixa de Seleção',
      select: 'Lista Suspensa',
      'text-block': 'Texto Livre',
      logo: 'Logo da Empresa',
      divider: 'Linha Divisória',
      table: 'Tabela Simples',
      signature: 'Bloco de Assinatura',
      textarea: 'Área de Texto',
    };
    return labels[type] || 'Campo';
  };

  const createComponentId = () =>
    `comp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const addComponent = (
    type: string,
    index?: number,
    position?: { x: number; y: number }
  ) => {
    const defaultWidth = getComponentDefaultWidth(type);
    const defaultHeightValue = getComponentDefaultHeight(type);
    const defaultHeight = `${defaultHeightValue}px`;
    const widthPx = parseSizePx(
      defaultWidth,
      DEFAULT_COMPONENT_WIDTH,
      contentWidthPx
    );
    const heightPx = parseSizePx(
      defaultHeight,
      defaultHeightValue,
      contentHeightPx
    );
    const initialPosition =
      layoutMode === 'free'
        ? position || getNextComponentPosition(currentPage, widthPx, heightPx)
        : undefined;

    const newComponent: FormComponent = {
      id: createComponentId(),
      type,
      label: getDefaultLabel(type),
      placeholder:
        type === 'textarea'
          ? 'Digite seu texto aqui...'
          : `Digite ${getDefaultLabel(type).toLowerCase()}`,
      required: false,
      ...(FIELD_COMPONENT_TYPES.includes(type) ? { showInput: true } : {}),
      width: defaultWidth,
      height: defaultHeight,
      page: currentPage,
      rotation: 0,
      ...(layoutMode === 'free' && initialPosition
        ? { x: initialPosition.x, y: initialPosition.y }
        : {}),
      ...(type === 'text-block' && { defaultValue: 'Texto livre' }),
      ...(type === 'select' && { options: ['Opcao 1', 'Opcao 2'] }),
      ...(type === 'textarea' && { rows: 4 }),
    };

    if (index !== undefined) {
      const newComponents = [...components];
      newComponents.splice(index, 0, newComponent);
      setComponents(newComponents);
    } else {
      setComponents([...components, newComponent]);
    }
    setSelectedComponent(newComponent);
  };

  const updateComponent = (id: string, updates: Partial<FormComponent>) => {
    setComponents((prev) =>
      prev.map((comp) => (comp.id === id ? { ...comp, ...updates } : comp))
    );
    setSelectedComponent((prev) =>
      prev?.id === id ? { ...prev, ...updates } : prev
    );
  };

  const deleteComponent = (id: string) => {
    setComponents(components.filter((comp) => comp.id !== id));
    if (selectedComponent?.id === id) {
      setSelectedComponent(null);
    }
  };

  const handleBackgroundUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingBackground(true);
    try {
      let nextBackgrounds: TemplateBackground[] = [];
      const isPdf =
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const data = await file.arrayBuffer();
        const pdf = await getDocument({
          data,
          verbosity: VerbosityLevel.ERRORS,
        }).promise;

        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Falha ao renderizar o PDF.');
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          const safeName = file.name.replace(/\.pdf$/i, '');
          const uploaded = await uploadBackgroundDataUrl(
            dataUrl,
            `${safeName}-pag-${pageIndex}.png`
          );
          nextBackgrounds.push(uploaded);
        }
      } else {
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await uploadBackgroundDataUrl(dataUrl, file.name);
        nextBackgrounds = [uploaded];
      }

      if (nextBackgrounds.length === 0) {
        throw new Error('Nenhuma pagina valida foi encontrada.');
      }

      setBackgrounds(nextBackgrounds);
      setCurrentPage(0);
      setLayoutMode('free');
      toast({
        title: 'Modelo carregado',
        description: 'O modelo foi aplicado como fundo.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar modelo',
        description: error.message || 'Nao foi possivel carregar o modelo.',
      });
    } finally {
      setIsUploadingBackground(false);
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = '';
      }
    }
  };

  const handleRemoveBackground = () => {
    setBackgrounds([null]);
    setCurrentPage(0);
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !selectedComponent || selectedComponent.type !== 'logo') {
      if (logoInputRef.current) {
        // logoInputRef.current.value = '';
      }
      return;
    }

    setIsUploadingLogo(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const uploaded = await uploadLogoDataUrl(
        dataUrl,
        file.name,
        selectedComponent.id
      );
      updateComponent(selectedComponent.id, {
        logoUrl: uploaded.url,
        logoAssetId: uploaded.assetId || undefined,
      });
      toast({
        title: 'Logo enviado',
        description: 'O logo foi atualizado com sucesso.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar logo',
        description: error.message || 'Nao foi possivel enviar o logo.',
      });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        // logoInputRef.current.value = '';
      }
    }
  };

  const handleResizeStart = (
    event: React.PointerEvent<HTMLDivElement>,
    componentId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const target = components.find((comp) => comp.id === componentId);
    if (target) {
      setSelectedComponent(target);
    }
    const container = event.currentTarget.closest(
      '[data-component-id]'
    ) as HTMLDivElement | null;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const contentRect = contentAreaRef.current?.getBoundingClientRect();
    const originX = target?.x ?? (contentRect ? rect.left - contentRect.left : 0);
    const originY = target?.y ?? (contentRect ? rect.top - contentRect.top : 0);
    resizingRef.current = {
      id: componentId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'se-resize';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvent.clientX - resizingRef.current.startX;
      const deltaY = moveEvent.clientY - resizingRef.current.startY;
      let nextWidth = Math.max(
        MIN_COMPONENT_WIDTH,
        resizingRef.current.startWidth + deltaX
      );
      let nextHeight = Math.max(
        MIN_COMPONENT_HEIGHT,
        resizingRef.current.startHeight + deltaY
      );
      updateComponent(componentId, {
        width: `${Math.round(nextWidth)}px`,
        height: `${Math.round(nextHeight)}px`,
      });
    };

    const handlePointerUp = () => {
      resizingRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleMoveStart = (
    event: React.PointerEvent<HTMLElement>,
    componentId: string
  ) => {
    if (layoutMode !== 'free') return;
    event.preventDefault();
    event.stopPropagation();

    const target = components.find((comp) => comp.id === componentId);
    if (target) {
      setSelectedComponent(target);
    }

    const container = event.currentTarget.closest(
      '[data-component-id]'
    ) as HTMLDivElement | null;
    const fallbackContainer = componentRefs.current[componentId] ?? null;
    const resolvedContainer = fallbackContainer ?? container;
    const contentRect = contentAreaRef.current?.getBoundingClientRect();
    if (!resolvedContainer || !contentRect) return;

    const rect = resolvedContainer.getBoundingClientRect();
    const originX = target?.x ?? rect.left - contentRect.left;
    const originY = target?.y ?? rect.top - contentRect.top;
    draggingRef.current = {
      id: componentId,
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'move';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!draggingRef.current) return;
      const deltaX = moveEvent.clientX - draggingRef.current.startX;
      const deltaY = moveEvent.clientY - draggingRef.current.startY;
      const nextX = draggingRef.current.originX + deltaX;
      const nextY = draggingRef.current.originY + deltaY;

      updateComponent(componentId, {
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    };

    const handlePointerUp = () => {
      draggingRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleRotateStart = (
    event: React.PointerEvent<HTMLElement>,
    componentId: string
  ) => {
    if (layoutMode !== 'free') return;
    event.preventDefault();
    event.stopPropagation();

    const target = components.find((comp) => comp.id === componentId);
    if (target) {
      setSelectedComponent(target);
    }

    const container = event.currentTarget.closest(
      '[data-component-id]'
    ) as HTMLDivElement | null;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const startRotation = target?.rotation ?? 0;

    rotatingRef.current = {
      id: componentId,
      centerX,
      centerY,
      startAngle,
      startRotation,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!rotatingRef.current) return;
      const angle = Math.atan2(
        moveEvent.clientY - rotatingRef.current.centerY,
        moveEvent.clientX - rotatingRef.current.centerX
      );
      const delta = ((angle - rotatingRef.current.startAngle) * 180) / Math.PI;
      updateComponent(componentId, {
        rotation: Math.round(rotatingRef.current.startRotation + delta),
      });
    };

    const handlePointerUp = () => {
      rotatingRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('component-type', type);
    setDraggedComponent(type);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index?: number) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('component-type');

    if (componentType) {
      addComponent(componentType, index);
    }

    setDraggedComponent(null);
    setDragOverIndex(null);
  };

  const handleDesignAreaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('component-type');

    if (componentType) {
      if (layoutMode === 'free' && contentAreaRef.current) {
        const rect = contentAreaRef.current.getBoundingClientRect();
        const dropX = e.clientX - rect.left;
        const dropY = e.clientY - rect.top;
        addComponent(componentType, undefined, { x: dropX, y: dropY });
      } else {
        addComponent(componentType);
      }
    }

    setDraggedComponent(null);
  };

  const handleDesignAreaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const moveComponent = (fromIndex: number, toIndex: number) => {
    const newComponents = [...components];
    const [moved] = newComponents.splice(fromIndex, 1);
    newComponents.splice(toIndex, 0, moved);
    setComponents(newComponents);
  };

  const handleComponentDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('component-index', index.toString());
  };

  const handleComponentDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleComponentDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('component-index'));

    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      moveComponent(fromIndex, toIndex);
    }

    setDragOverIndex(null);
  };

  const buildTemplatePayload = (): TemplatePayload => ({
    layoutMode,
    pageCount,
    backgrounds,
    components,
  });

  const handleSaveDraft = () => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Nome da RAT obrigatorio',
        description: 'Informe o nome da RAT antes de salvar.',
      });
      return;
    }
    if (!templateScope) {
      toast({
        variant: 'destructive',
        title: 'Selecione o tipo de RAT',
        description: 'Escolha entre vincular a uma empresa ou RAT avulsa.',
      });
      return;
    }
    if (templateScope === 'client' && !selectedPartnerClientId) {
      toast({
        variant: 'destructive',
        title: 'Selecione a empresa parceira',
        description: 'Escolha a empresa parceira antes de salvar o template.',
      });
      return;
    }
    setConfirmDialog({ action: 'draft', trimmedName });
  };

  const handlePublish = () => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toast({
        variant: 'destructive',
        title: 'Nome da RAT obrigatorio',
        description: 'Informe o nome da RAT antes de salvar.',
      });
      return;
    }
    if (!templateScope) {
      toast({
        variant: 'destructive',
        title: 'Selecione o tipo de RAT',
        description: 'Escolha entre vincular a uma empresa ou RAT avulsa.',
      });
      return;
    }
    if (templateScope === 'client' && !selectedPartnerClientId) {
      toast({
        variant: 'destructive',
        title: 'Selecione a empresa parceira',
        description: 'Escolha a empresa parceira antes de salvar o template.',
      });
      return;
    }
    setConfirmDialog({ action: 'publish', trimmedName });
  };

  const handleLoadSavedTemplate = (template: ServiceOrderTemplate) => {
    const payload = template?.template;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      toast({
        variant: 'destructive',
        title: 'Template invalido',
        description: 'Nao foi possivel carregar esse template.',
      });
      return;
    }

    const nextLayoutMode = payload.layoutMode === 'flow' ? 'flow' : 'free';
    const nextBackgrounds =
      Array.isArray(payload.backgrounds) && payload.backgrounds.length > 0
        ? payload.backgrounds
        : [null];
    const nextComponents = Array.isArray(payload.components)
      ? payload.components
      : [];

    setTemplateName(template.name || 'Template sem nome');
    setTemplateScope(template.clientId ? 'client' : 'avulsa');
    setSelectedPartnerClientId(template.clientId || '');
    setEditingTemplateId(template.id);
    setLayoutMode(nextLayoutMode);
    setBackgrounds(nextBackgrounds);
    setCurrentPage(0);
    setComponents(nextComponents);
    setSelectedComponent(null);
    setDraggedComponent(null);
    setDragOverIndex(null);
    toast({
      title: 'Template carregado',
      description: 'O template foi carregado no editor.',
    });
  };

  const handleDeleteTemplate = (template: ServiceOrderTemplate) => {
    deleteTemplateMutation.mutate(template.id, {
      onSuccess: () => {
        if (editingTemplateId === template.id) {
          setEditingTemplateId(null);
        }
        toast({
          title: 'Template excluido',
          description: 'O template foi removido com sucesso.',
        });
      },
    });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog) return;
    const trimmedName = confirmDialog.trimmedName || templateName.trim();
    const action = confirmDialog.action;
    const template = confirmDialog.template;
    setConfirmDialog(null);

    if (action === 'load' && template) {
      handleLoadSavedTemplate(template);
      return;
    }
    if (action === 'delete' && template) {
      handleDeleteTemplate(template);
      return;
    }
    if (action === 'draft') {
      saveDraftMutation.mutate({
        name: trimmedName,
        template: buildTemplatePayload(),
        clientId: templateScope === 'client' ? selectedPartnerClientId : undefined,
        templateId: editingTemplateId,
      });
      return;
    }
    if (action === 'publish') {
      publishMutation.mutate({
        name: trimmedName,
        template: buildTemplatePayload(),
        clientId: templateScope === 'client' ? selectedPartnerClientId : undefined,
        templateId: editingTemplateId,
      });
    }
  };

  const handlePreviewPDF = async () => {
    if (
      !requirePaid({
        feature: 'Geracao de PDF',
        description: 'Geracao de PDF esta disponivel apenas na versao paga.',
      })
    ) {
      return;
    }
    setShowPreview(true);
    return;
    try {
      // Importar dinamicamente as bibliotecas necessárias
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      // Criar um elemento temporário para renderizar o conteúdo do PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.style.width = pageWidthMm;
      pdfContainer.style.minHeight = pageHeightMm;
      pdfContainer.style.padding = pageMarginMm;
      pdfContainer.style.boxSizing = 'border-box';
      pdfContainer.style.backgroundColor = 'white';
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.position = 'absolute';
      pdfContainer.style.left = '-9999px';
      pdfContainer.style.top = '0';
      pdfContainer.style.overflow = 'hidden';

      // Adicionar título
      const title = document.createElement('h1');
      title.textContent = templateName;
      title.style.fontSize = '24px';
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '20px';
      title.style.color = '#111418';
      pdfContainer.appendChild(title);

      const componentsWrapper = document.createElement('div');
      componentsWrapper.style.width = '100%';
      if (layoutMode === 'free') {
        componentsWrapper.style.position = 'relative';
        componentsWrapper.style.minHeight = pageHeightMm;
      } else {
        componentsWrapper.style.display = 'flex';
        componentsWrapper.style.flexWrap = 'wrap';
        componentsWrapper.style.gap = '16px';
      }
      pdfContainer.appendChild(componentsWrapper);

      // Renderizar cada componente
      componentsForPage.forEach((component) => {
        const componentDiv = document.createElement('div');
        componentDiv.style.display = 'flex';
        componentDiv.style.flexDirection = 'column';
        componentDiv.style.gap = '8px';
        componentDiv.style.width = component.width || '100%';
        componentDiv.style.boxSizing = 'border-box';
        if (layoutMode === 'free') {
          componentDiv.style.position = 'absolute';
          componentDiv.style.left = `${component.x ?? 0}px`;
          componentDiv.style.top = `${component.y ?? 0}px`;
          componentDiv.style.transform = `rotate(${component.rotation ?? 0}deg)`;
          componentDiv.style.transformOrigin = 'center';
        }
        if (component.height) {
          componentDiv.style.height = component.height;
        }

        const showLabel = !['logo', 'divider', 'table', 'text-block'].includes(
          component.type
        );
        const showInput = component.showInput !== false;
        const isFieldComponent = FIELD_COMPONENT_TYPES.includes(component.type);
        if (showLabel) {
          const label = document.createElement('label');
          label.textContent = component.label + (component.required ? ' *' : '');
          label.style.display = 'block';
          label.style.fontSize = '14px';
          label.style.fontWeight = '600';
          label.style.marginBottom = '8px';
          label.style.color = '#111418';
          componentDiv.appendChild(label);
        }

        if (isFieldComponent && !showInput) {
          componentsWrapper.appendChild(componentDiv);
          return;
        }

        // Campo baseado no tipo
        if (component.type === 'text' || component.type === 'number') {
        const input = document.createElement('input');
        input.type = component.type === 'number' ? 'number' : 'text';
        input.placeholder = component.placeholder || '';
        input.value = component.defaultValue || '';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.border = 'none';
        input.style.borderRadius = '4px';
        input.style.fontSize = '14px';
        input.style.boxSizing = 'border-box';
        input.style.flex = '1';
        input.style.height = '100%';
        input.style.background = 'transparent';
        input.style.outline = 'none';
        input.disabled = true;
        componentDiv.appendChild(input);
      } else if (component.type === 'datetime') {
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.value = component.defaultValue || '';
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.border = 'none';
        input.style.borderRadius = '4px';
        input.style.fontSize = '14px';
        input.style.boxSizing = 'border-box';
        input.style.flex = '1';
        input.style.height = '100%';
        input.style.background = 'transparent';
        input.style.outline = 'none';
        input.disabled = true;
        componentDiv.appendChild(input);
      } else if (component.type === 'checkbox') {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.display = 'flex';
        checkboxDiv.style.alignItems = 'center';
        checkboxDiv.style.gap = '8px';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.disabled = true;
          checkbox.style.width = '16px';
          checkbox.style.height = '16px';
          const span = document.createElement('span');
          span.textContent = component.placeholder || '';
          span.style.fontSize = '14px';
          span.style.color = '#60708a';
          checkboxDiv.appendChild(checkbox);
        checkboxDiv.appendChild(span);
        componentDiv.appendChild(checkboxDiv);
      } else if (component.type === 'select') {
        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '8px';
        select.style.border = 'none';
        select.style.borderRadius = '4px';
        select.style.fontSize = '14px';
        select.style.boxSizing = 'border-box';
        select.style.flex = '1';
        select.style.height = '100%';
        select.style.background = 'transparent';
        select.style.outline = 'none';
        select.disabled = true;
        const option = document.createElement('option');
        option.textContent = component.placeholder || 'Selecione...';
        select.appendChild(option);
          component.options?.forEach((opt) => {
            const optEl = document.createElement('option');
            optEl.textContent = opt;
            select.appendChild(optEl);
          });
          if (component.defaultValue) {
            select.value = component.defaultValue;
        }
        componentDiv.appendChild(select);
      } else if (component.type === 'textarea') {
        const textarea = document.createElement('textarea');
        textarea.placeholder = component.placeholder || '';
        textarea.rows = component.rows || 4;
        textarea.value = component.defaultValue || '';
        textarea.style.width = '100%';
        textarea.style.padding = '8px';
        textarea.style.border = 'none';
        textarea.style.borderRadius = '4px';
        textarea.style.fontSize = '14px';
        textarea.style.background = 'transparent';
        textarea.style.outline = 'none';
          textarea.style.fontFamily = 'Arial, sans-serif';
          textarea.style.boxSizing = 'border-box';
          textarea.style.flex = '1';
          textarea.style.height = '100%';
          textarea.disabled = true;
          componentDiv.appendChild(textarea);
        } else if (component.type === 'text-block') {
          const textBlock = document.createElement('div');
          textBlock.textContent =
            component.defaultValue ||
            (component.binding ? `{${component.binding}}` : '');
          textBlock.style.fontSize = '14px';
          textBlock.style.color = '#111418';
          textBlock.style.whiteSpace = 'pre-wrap';
          componentDiv.appendChild(textBlock);
        } else if (component.type === 'logo') {
          const logoDiv = document.createElement('div');
          // logoDiv.style.display = 'flex';
          // logoDiv.style.alignItems = 'center';
          // logoDiv.style.justifyContent = 'center';
          // logoDiv.style.height = component.height ? '100%' : '80px';
          // logoDiv.style.flex = '1';
          if (component.logoUrl) {
            const logoImg = document.createElement('img');
            // logoImg.src = component.logoUrl;
            // logoImg.alt = component.label || 'Logo da Empresa';
            // logoImg.style.width = '100%';
            // logoImg.style.height = '100%';
            // logoImg.style.objectFit = 'contain';
            // logoImg.style.display = 'block';
            // logoImg.crossOrigin = 'anonymous';
            // logoDiv.appendChild(logoImg);
          }
          componentDiv.appendChild(logoDiv);
        } else if (component.type === 'divider') {
          const hr = document.createElement('hr');
          hr.style.border = 'none';
          hr.style.borderTop = '2px solid #e5e7eb';
          hr.style.margin = '20px 0';
          componentDiv.appendChild(hr);
        } else if (component.type === 'table') {
          const table = document.createElement('table');
          table.style.width = '100%';
          table.style.borderCollapse = 'collapse';
          table.style.border = '1px solid #e5e7eb';
          table.style.borderRadius = '4px';
          table.style.overflow = 'hidden';
          const thead = document.createElement('thead');
          thead.style.backgroundColor = '#f5f7f8';
          const headerRow = document.createElement('tr');
          ['Coluna 1', 'Coluna 2'].forEach((col) => {
            const th = document.createElement('th');
            th.textContent = col;
            th.style.padding = '12px';
            th.style.textAlign = 'left';
            th.style.fontSize = '14px';
            th.style.fontWeight = '600';
            th.style.borderRight = '1px solid #e5e7eb';
            headerRow.appendChild(th);
          });
          thead.appendChild(headerRow);
          table.appendChild(thead);
          const tbody = document.createElement('tbody');
          const dataRow = document.createElement('tr');
          ['Linha 1', 'Linha 1'].forEach((cell, idx) => {
            const td = document.createElement('td');
            td.textContent = cell;
            td.style.padding = '12px';
            td.style.fontSize = '14px';
            td.style.borderTop = '1px solid #e5e7eb';
            if (idx === 0) {
              td.style.borderRight = '1px solid #e5e7eb';
            }
            dataRow.appendChild(td);
          });
          tbody.appendChild(dataRow);
          table.appendChild(tbody);
          componentDiv.appendChild(table);
        } else if (component.type === 'signature') {
          const signatureDiv = document.createElement('div');
          signatureDiv.style.display = 'flex';
          signatureDiv.style.flexDirection = 'column';
          signatureDiv.style.alignItems = 'center';
          signatureDiv.style.justifyContent = 'center';
          signatureDiv.style.height = component.height ? '100%' : '80px';
          signatureDiv.style.flex = '1';
          signatureDiv.style.border = '2px dashed #e5e7eb';
          signatureDiv.style.borderRadius = '8px';
          signatureDiv.style.backgroundColor = '#f5f7f8';
          const signatureText = document.createElement('span');
          signatureText.textContent = 'Área de Assinatura';
          signatureText.style.color = '#60708a';
          signatureText.style.fontSize = '14px';
          signatureDiv.appendChild(signatureText);
          componentDiv.appendChild(signatureDiv);
        }

        componentsWrapper.appendChild(componentDiv);
      });

      document.body.appendChild(pdfContainer);

      // Gerar PDF usando html2canvas e jsPDF
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        // logging: false,
        backgroundColor: '#ffffff',
      });

      document.body.removeChild(pdfContainer);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210; // A4 width in mm
      const pdfPageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfPageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfPageHeight;
      }

      // Salvar o PDF
      pdf.save(`${templateName || 'ordem-de-servico'}.pdf`);

      toast({
        title: 'PDF gerado com sucesso',
        description: 'O PDF foi gerado e está sendo baixado.',
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar PDF',
        description: error.message || 'Não foi possível gerar o PDF.',
      });
    }
  };

  const renderComponent = (
    component: FormComponent,
    index: number,
    options?: { preview?: boolean }
  ) => {
    const isPreview = options?.preview ?? false;
    const isSelected = !isPreview && selectedComponent?.id === component.id;
    const isFreeLayout = layoutMode === 'free';
    const isDragOver = !isPreview && !isFreeLayout && dragOverIndex === index;
    const isEditingLabel = !isPreview && editingLabelId === component.id;
    const isEditingTextBlock = !isPreview && editingTextBlockId === component.id;
    const rotation = component.rotation ?? 0;
    const isFieldComponent = FIELD_COMPONENT_TYPES.includes(component.type);
    const showInput = component.showInput !== false;
    const rowAlignClass =
      component.type === 'textarea' ? 'items-start' : 'items-center';
    const fieldInputClass =
      'w-full h-full bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0';
    const inputContainerClass = `flex-1 min-w-0 ${
      showInput ? '' : 'opacity-0 pointer-events-none'
    }`;
    const componentStyle = {
      width: component.width || '100%',
      ...(component.height ? { height: component.height } : {}),
      position: isFreeLayout ? 'absolute' : 'relative',
      ...(isFreeLayout
        ? {
            left: component.x ?? 0,
            top: component.y ?? 0,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center',
            zIndex: isSelected ? 5 : 1,
          }
        : {}),
    };

    const labelContent = isEditingLabel ? (
      <div className='flex items-center gap-1'>
        <Input
          value={component.label}
          onChange={(e) =>
            updateComponent(component.id, { label: e.target.value })
          }
          onBlur={() => setEditingLabelId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              e.preventDefault();
              setEditingLabelId(null);
            }
          }}
          size={Math.max(4, component.label.length)}
          className='h-7 w-auto min-w-[64px] px-2 text-sm bg-transparent'
          autoFocus
        />
        {component.required && <span className='text-red-500'>*</span>}
      </div>
    ) : (
      <Label
        className='text-sm font-medium text-gray-700 dark:text-gray-300 cursor-text truncate'
        onDoubleClick={
          isPreview
            ? undefined
            : (e) => {
                e.stopPropagation();
                setEditingLabelId(component.id);
              }
        }
      >
        {component.label}
        {component.required && <span className='text-red-500 ml-1'>*</span>}
      </Label>
    );

    const bindingBadge = component.binding ? (
      <span
        className={`text-xs text-[#1d4ed8] dark:text-blue-200 bg-[#dbeafe]/60 dark:bg-blue-900/40 px-2 py-0.5 rounded-full self-start ${
          isPreview ? 'opacity-0' : ''
        }`}
      >
        {getBindingLabel(component.binding)}
      </span>
    ) : null;

    const wrapperPaddingClass = component.type === 'logo' ? 'p-0' : 'p-4';
    const wrapperClass = isPreview
      ? `group relative ${wrapperPaddingClass} border-2 border-transparent rounded-lg flex flex-col flex-none pointer-events-none`
      : `group relative ${wrapperPaddingClass} border-2 rounded-lg transition-all cursor-pointer flex flex-col flex-none ${
          isSelected
            ? 'border-[#3880f5] bg-blue-50/30 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-transparent hover:bg-slate-50/40 dark:hover:bg-white/5'
        } ${isDragOver ? 'border-[#3880f5] border-dashed' : ''}`;

    return (
      <div
        key={component.id}
        data-component-id={component.id}
        ref={
          isPreview
            ? undefined
            : (node) => {
                if (node) {
                  componentRefs.current[component.id] = node;
                } else {
                  delete componentRefs.current[component.id];
                }
              }
        }
        onDragOver={
          isPreview || isFreeLayout
            ? undefined
            : (e) => handleComponentDragOver(e, index)
        }
        onDrop={
          isPreview || isFreeLayout
            ? undefined
            : (e) => handleComponentDrop(e, index)
        }
        onClick={isPreview ? undefined : () => setSelectedComponent(component)}
        style={componentStyle}
        className={wrapperClass}
      >
        <div
          className={`absolute right-2 top-2 transition-opacity ${
            isPreview ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-6 w-6 p-0'
            onClick={
              isPreview
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    deleteComponent(component.id);
                  }
            }
          >
            <Trash2 className='w-4 h-4 text-red-500' />
          </Button>
        </div>
        {isFieldComponent ? (
          <div className={`flex ${rowAlignClass} gap-1`}>
            <div className='flex flex-col gap-1 shrink-0'>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  className={`flex items-center ${
                    isPreview
                      ? 'opacity-0'
                      : isFreeLayout
                      ? 'cursor-move'
                      : 'cursor-grab active:cursor-grabbing'
                  }`}
                  draggable={!isPreview && !isFreeLayout}
                  onDragStart={
                    isPreview || isFreeLayout
                      ? undefined
                      : (e) => handleComponentDragStart(e, index)
                  }
                  onPointerDown={
                    isPreview
                      ? undefined
                      : isFreeLayout
                      ? (e) => handleMoveStart(e, component.id)
                      : undefined
                  }
                  title={
                    isPreview
                      ? undefined
                      : isFreeLayout
                      ? 'Arraste para mover'
                      : 'Arraste para reordenar'
                  }
                >
                  <GripVertical className='w-4 h-4 text-gray-400' />
                </button>
                <div className='min-w-0'>{labelContent}</div>
              </div>
              {bindingBadge}
            </div>
            <div className={inputContainerClass}>
              {component.type === 'text' && (
                <div className='flex-1 flex items-stretch'>
                  <Input
                    placeholder={component.placeholder}
                    value={component.defaultValue || ''}
                    className={fieldInputClass}
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {component.type === 'number' && (
                <div className='flex-1 flex items-stretch'>
                  <Input
                    type='number'
                    placeholder={component.placeholder}
                    value={component.defaultValue || ''}
                    className={fieldInputClass}
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {component.type === 'datetime' && (
                <div className='flex-1 flex items-stretch'>
                  <Input
                    type='datetime-local'
                    value={component.defaultValue || ''}
                    className={fieldInputClass}
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {component.type === 'checkbox' && (
                <div className='flex items-center gap-2'>
                  <input
                    type='checkbox'
                    checked={component.defaultValue === 'true'}
                    className='w-4 h-4'
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.checked ? 'true' : '',
                      })
                    }
                  />
                  <span className='text-sm text-gray-500'>
                    {component.placeholder}
                  </span>
                </div>
              )}

              {component.type === 'select' && (
                <div className='flex-1 flex items-stretch'>
                  <select
                    value={component.defaultValue || ''}
                    className='w-full h-full px-3 py-2 border-0 bg-transparent text-gray-600 dark:text-gray-300 focus:outline-none'
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.value,
                      })
                    }
                  >
                    <option value=''>{component.placeholder}</option>
                    {component.options?.map((opt, i) => (
                      <option key={i} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {component.type === 'textarea' && (
                <div className='flex-1 flex items-stretch'>
                  <Textarea
                    placeholder={component.placeholder}
                    rows={component.rows || 4}
                    value={component.defaultValue || ''}
                    className={fieldInputClass}
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.value,
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {component.type !== 'logo' && (
              <div className='flex items-center gap-2 mb-2'>
              <button
                type='button'
                className={`flex items-center ${
                  isPreview
                    ? 'opacity-0'
                    : isFreeLayout
                    ? 'cursor-move'
                    : 'cursor-grab active:cursor-grabbing'
                }`}
                draggable={!isPreview && !isFreeLayout}
                onDragStart={
                  isPreview || isFreeLayout
                    ? undefined
                    : (e) => handleComponentDragStart(e, index)
                }
                onPointerDown={
                  isPreview
                    ? undefined
                    : isFreeLayout
                    ? (e) => handleMoveStart(e, component.id)
                    : undefined
                }
                title={
                  isPreview
                    ? undefined
                    : isFreeLayout
                    ? 'Arraste para mover'
                    : 'Arraste para reordenar'
                }
              >
                <GripVertical className='w-4 h-4 text-gray-400' />
              </button>
                <div className='min-w-0 flex-1'>{labelContent}</div>
                {bindingBadge}
              </div>
            )}

            {component.type === 'text-block' && (
              <div className='flex-1 flex items-start'>
                {isEditingTextBlock ? (
                  <Textarea
                    value={component.defaultValue || ''}
                    onChange={(e) =>
                      updateComponent(component.id, {
                        defaultValue: e.target.value,
                      })
                    }
                    onBlur={() => setEditingTextBlockId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingTextBlockId(null);
                      }
                    }}
                    className='w-full h-full bg-transparent'
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <p
                    className='text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap cursor-text'
                    onDoubleClick={
                      isPreview
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            setEditingTextBlockId(component.id);
                          }
                    }
                  >
                    {component.defaultValue ||
                      (component.binding
                        ? `{${component.binding}}`
                        : 'Texto livre')}
                  </p>
                )}
              </div>
            )}

            {component.type === 'logo' && (
              <div
                className={`flex-1 flex items-center justify-center rounded-lg bg-transparent h-full w-full overflow-hidden ${
                  component.logoUrl
                    ? ''
                    : isPreview
                    ? ''
                    : 'border-2 border-dashed border-gray-300 dark:border-gray-600'
                }`}
                draggable={!isPreview && !isFreeLayout}
                onDragStart={
                  isPreview || isFreeLayout
                    ? undefined
                    : (e) => handleComponentDragStart(e, index)
                }
                onPointerDown={
                  isPreview
                    ? undefined
                    : isFreeLayout
                    ? (e) => handleMoveStart(e, component.id)
                    : undefined
                }
                title={
                  isPreview
                    ? undefined
                    : isFreeLayout
                    ? 'Arraste para mover'
                    : 'Arraste para reordenar'
                }
              >
                {component.logoUrl ? (
                  <img
                    src={component.logoUrl}
                    alt={component.label || 'Logo da Empresa'}
                    className='h-full w-full object-contain'
                    draggable={false}
                  />
                ) : isPreview ? null : (
                  <div className='text-center'>
                    <Image className='w-12 h-12 mx-auto text-gray-400 mb-2' />
                    <p className='text-sm text-gray-500'>Logo da Empresa</p>
                  </div>
                )}
              </div>
            )}

            {component.type === 'divider' && (
              <div className='border-t-2 border-gray-300 dark:border-gray-600 my-2' />
            )}

            {component.type === 'table' && (
              <div className='flex-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden min-h-[120px]'>
                <table className='w-full'>
                  <thead className='bg-transparent'>
                    <tr>
                      <th className='px-4 py-2 text-left text-sm font-medium border-r border-gray-300 dark:border-gray-600'>
                        Coluna 1
                      </th>
                      <th className='px-4 py-2 text-left text-sm font-medium'>
                        Coluna 2
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className='px-4 py-2 border-r border-t border-gray-300 dark:border-gray-600'>
                        Linha 1
                      </td>
                      <td className='px-4 py-2 border-t border-gray-300 dark:border-gray-600'>
                        Linha 1
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {component.type === 'signature' && (
              <div className='flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-transparent min-h-[128px]'>
                <PenTool className='w-12 h-12 text-gray-400 mb-2' />
                <p className='text-sm text-gray-500'>?rea de Assinatura</p>
              </div>
            )}
          </>
        )}
        {isFreeLayout && (
          <div
            className={`absolute -top-4 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 transition-opacity ${
              isPreview ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
            }`}
            style={{ cursor: 'grab' }}
            onPointerDown={
              isPreview ? undefined : (e) => handleRotateStart(e, component.id)
            }
            title={isPreview ? undefined : 'Arraste para rotacionar'}
          >
            <RotateCw className='w-3 h-3 text-gray-500' />
          </div>
        )}
        <div
          className={`absolute bottom-2 right-2 h-3 w-3 rounded-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 transition-opacity ${
            isPreview ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{ cursor: isPreview ? 'default' : 'se-resize' }}
          onPointerDown={
            isPreview ? undefined : (e) => handleResizeStart(e, component.id)
          }
          title={isPreview ? undefined : 'Arraste para redimensionar'}
        />
      </div>
    );
  };

  const renderPreviewComponent = (component: FormComponent) => {
    const componentIndex = componentIndexById.get(component.id) ?? 0;
    return renderComponent(component, componentIndex, { preview: true });
  };

  const renderPreviewPage = (showComponents: boolean, showBackground: boolean) => {
    const pageStyle = {
      width: `${pageWidthPx}px`,
      height: `${pageHeightPx}px`,
      backgroundColor: '#ffffff',
      boxSizing: 'border-box' as const,
    };
    const containerClass =
      layoutMode === 'free'
        ? 'relative h-full w-full'
        : 'flex flex-wrap gap-4 items-start h-full w-full';
    const contentStyle = showBackground && currentBackground?.url
      ? {
          backgroundImage: `url(${currentBackground.url})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }
      : undefined;

    return (
      <div
        className='shrink-0 rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden'
        style={pageStyle}
      >
        <div className={containerClass} style={contentStyle}>
          {showComponents && componentsForPage.map(renderPreviewComponent)}
        </div>
      </div>
    );
  };

  const bindingOptions = [
    { value: '', label: 'Sem preenchimento' },
    { value: 'ticket.number', label: 'Numero do chamado' },
    { value: 'ticket.description', label: 'Descricao do chamado' },
    { value: 'ticket.date', label: 'Data do chamado' },
    { value: 'ticket.time', label: 'Hora do chamado' },
    { value: 'ticket.scheduledFor', label: 'Data e hora do chamado' },
    { value: 'ticket.arrivalAt', label: 'Data e hora de chegada' },
    { value: 'ticket.arrivalDate', label: 'Data de chegada' },
    { value: 'ticket.arrivalTime', label: 'Hora de chegada' },
    { value: 'ticket.completedAt', label: 'Data e hora de encerramento' },
    { value: 'ticket.completedDate', label: 'Data de encerramento' },
    { value: 'ticket.completedTime', label: 'Hora de encerramento' },
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
    { value: 'signature.technician', label: 'Assinatura do tecnico' },
    { value: 'signature.client', label: 'Assinatura do cliente' },
  ];

  const getBindingLabel = (binding?: string) => {
    if (!binding) return '';
    return (
      bindingOptions.find((option) => option.value === binding)?.label ||
      binding
    );
  };

  const toolboxItems = [
    { icon: Type, label: 'Campo de Texto', type: 'text' },
    { icon: AlignLeft, label: 'Texto Livre', type: 'text-block' },
    { icon: Hash, label: 'Input Numérico', type: 'number' },
    { icon: Calendar, label: 'Data/Hora', type: 'datetime' },
    { icon: CheckSquare, label: 'Caixa de Seleção', type: 'checkbox' },
    { icon: ChevronDown, label: 'Lista Suspensa', type: 'select' },
    { icon: FileText, label: 'Area de Texto', type: 'textarea' },
    { icon: Image, label: 'Logo da Empresa', type: 'logo' },
    { icon: Minus, label: 'Linha Divisória', type: 'divider' },
    { icon: TableIcon, label: 'Tabela Simples', type: 'table' },
    { icon: PenTool, label: 'Bloco de Assinatura', type: 'signature' },
  ];


  const handleShareEditorLink = () => {
    if (typeof window === 'undefined') return;
    const editorUrl = window.location.href;
    const message = `Editor de OS/RAT: ${editorUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.href = whatsappUrl;
    }
  };

  return (
    <div className='relative flex h-screen w-full flex-col bg-[#f5f7f8] dark:bg-[#101722] font-display overflow-hidden'>
      <div className='flex flex-1 items-center justify-center p-6 md:hidden'>
        <div className='w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900'>
          <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'>
            <FileText className='h-6 w-6' />
          </div>
          <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
            Editor de OS/RAT
          </h2>
          <p className='mt-2 text-sm text-slate-600 dark:text-gray-400'>
            Para criar ou editar sua ordem de servico, use um computador. Esta
            ferramenta nao e otimizada para celular.
          </p>
          <Button type='button' className='mt-4' onClick={handleShareEditorLink}>
            Compartilhar no WhatsApp
          </Button>
        </div>
      </div>
      <div className='hidden md:flex md:flex-1 md:flex-col'>
      <header className='flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#e5e7eb] dark:border-b-gray-800 bg-white dark:bg-[#101722] px-6 py-3'>
        <div className='flex items-center gap-8'>
          <div className='flex items-center gap-3'>
            <FileText className='h-6 w-6 text-[#3880f5]' />
            <h2 className='text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]'>
              Editor de Ordem de Serviço
            </h2>
          </div>
          <div className='flex items-center gap-2'>
            <Link
              href='/'
              className='text-[#60708a] dark:text-gray-400 text-sm font-medium leading-normal hover:text-[#3880f5]'
            >
              Dashboard
            </Link>
            <span className='text-[#c1c8d1] dark:text-gray-600'>/</span>
            <span className='text-[#111418] dark:text-white text-sm font-medium leading-normal'>
              Editor de Ordem de Serviço
            </span>
          </div>
        </div>
        <div className='flex flex-1 justify-end gap-2'>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                className='bg-white dark:bg-gray-800 text-[#111418] dark:text-white border border-gray-200 dark:border-gray-700'
                onClick={handleSaveDraft}
                disabled={saveDraftMutation.isPending}
              >
                <Save className='w-4 h-4 mr-2' />
                Salvar rascunho
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Rascunho fica so no editor e nao aparece na criacao de chamados.
            </TooltipContent>
          </Tooltip>
          <Button
            variant='outline'
            className='bg-white dark:bg-gray-800 text-[#111418] dark:text-white border border-gray-200 dark:border-gray-700'
            onClick={handlePreviewPDF}
          >
            <FileText className='w-4 h-4 mr-2' />
            Pré-visualizar em PDF
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className='bg-[#3880f5] hover:bg-[#3880f5]/90 text-white'
                onClick={handlePublish}
                disabled={publishMutation.isPending}
              >
                <Send className='w-4 h-4 mr-2' />
                {editingTemplateId ? 'Atualizar Template' : 'Salvar Template'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {editingTemplateId
                ? 'Atualiza o template selecionado.'
                : 'Template salvo fica disponivel para usar nos chamados.'}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      <div className='flex flex-1 overflow-hidden'>
        <div className='flex flex-1 min-h-0 flex-col overflow-hidden'>
          {/* Toolbox Bar */}
          <div className='border-b border-[#e5e7eb] dark:border-gray-800 bg-white dark:bg-[#101722] px-6 py-3'>
            <div className='flex flex-col gap-3'>
              <h3 className='text-[#111418] dark:text-white text-base font-semibold leading-normal'>
                Caixa de Ferramentas
              </h3>
              <div className='flex flex-nowrap items-center gap-2 overflow-x-auto pb-1'>
                {toolboxItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type='button'
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.type)}
                      className='flex items-center gap-2 rounded-lg border border-[#e5e7eb] dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 px-3 py-2 text-sm font-medium text-[#111418] dark:text-white hover:border-[#3880f5] hover:bg-[#f5f7ff] dark:hover:bg-gray-800 cursor-grab active:cursor-grabbing transition-colors whitespace-nowrap'
                    >
                      <Icon className='w-5 h-5 text-[#60708a] dark:text-gray-400' />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center Area (Design Canvas) */}
          <main className='flex flex-1 min-h-0 flex-col overflow-hidden p-6'>
          <div className='flex flex-wrap justify-between gap-3 pb-6'>
            <div className='flex min-w-72 flex-col gap-4'>
              <div className='grid gap-4 md:grid-cols-2'>
                <div className='flex flex-col gap-2'>
                  <Label htmlFor='rat-scope'>Tipo de RAT *</Label>
                  <select
                    id='rat-scope'
                    value={templateScope}
                    onChange={(e) => {
                      const nextScope = e.target.value as
                        | 'client'
                        | 'avulsa'
                        | '';
                      setTemplateScope(nextScope);
                      if (nextScope !== 'client') {
                        setSelectedPartnerClientId('');
                      }
                      setEditingTemplateId(null);
                    }}
                    className='w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200'
                  >
                    <option value=''>Selecione</option>
                    <option value='client'>Vincular a empresa</option>
                    <option value='avulsa'>RAT avulsa</option>
                  </select>
                </div>
                {templateScope === 'client' && (
                  <div className='flex flex-col gap-2'>
                    <Label htmlFor='partner-client'>Empresa parceira *</Label>
                    <select
                      id='partner-client'
                      value={selectedPartnerClientId}
                      onChange={(e) => {
                        setSelectedPartnerClientId(e.target.value);
                        setEditingTemplateId(null);
                      }}
                      className='w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200'
                    >
                      <option value=''>Selecione a empresa parceira</option>
                      {partnerClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className='flex flex-col gap-2 max-w-md'>
                <Label htmlFor='rat-name'>Nome da RAT *</Label>
                <Input
                  id='rat-name'
                  type='text'
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder='Nome da RAT'
                  className='text-lg font-semibold'
                />
                <p className='text-[#60708a] dark:text-gray-400 text-base font-normal leading-normal'>
                  Informe o nome e escolha o vinculo do template.
                </p>
              </div>
            </div>
          </div>

<div className='flex flex-wrap items-center justify-between gap-3 pb-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <input
                ref={backgroundInputRef}
                type='file'
                accept='application/pdf,image/*'
                className='hidden'
                onChange={handleBackgroundUpload}
              />
              <TooltipProvider delayDuration={2000}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='outline'
                      className='bg-white dark:bg-gray-800 text-[#111418] dark:text-white border border-gray-200 dark:border-gray-700'
                      onClick={() => backgroundInputRef.current?.click()}
                      disabled={isUploadingBackground}
                    >
                      {isUploadingBackground ? (
                        <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      ) : (
                        <Upload className='w-4 h-4 mr-2' />
                      )}
                      {hasBackground ? 'Trocar modelo' : 'Carregar modelo'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='max-w-xs text-xs leading-relaxed'>
                    O modelo fica apenas como base visual para posicionar os campos da RAT.
                    Ele nao aparece na pre-visualizacao nem e salvo no template final.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {hasBackground && (
                <Button
                  variant='outline'
                  className='bg-white dark:bg-gray-800 text-[#111418] dark:text-white border border-gray-200 dark:border-gray-700'
                  onClick={handleRemoveBackground}
                  disabled={isUploadingBackground}
                >
                  Remover modelo
                </Button>
              )}
            </div>
            <div className='flex items-center gap-2 text-xs text-[#60708a] dark:text-gray-400'>
              <Button
                variant='outline'
                size='icon'
                className='h-8 w-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className='w-4 h-4' />
              </Button>
              <span>
                Pagina {currentPage + 1} de {pageCount}
              </span>
              <Button
                variant='outline'
                size='icon'
                className='h-8 w-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                onClick={() =>
                  setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))
                }
                disabled={currentPage >= pageCount - 1}
              >
                <ChevronRight className='w-4 h-4' />
              </Button>
            </div>
          </div>

          <div className='-mx-6 flex-1 min-h-0 overflow-auto px-6 pb-6'>
            <div className='flex justify-start 2xl:justify-center'>
              <div className='relative min-w-max'>
              <Card
                ref={designAreaRef}
                className='flex flex-col rounded-xl bg-white dark:bg-white shadow-sm overflow-visible'
                style={{
                  width: pageWidthCss,
                  height: pageHeightCss,
                  boxSizing: 'border-box',
                }}
                onDrop={handleDesignAreaDrop}
                onDragOver={handleDesignAreaDragOver}
              >
                <div className='relative h-full w-full'>
                  <div
                    className='pointer-events-none absolute border border-dashed border-slate-200 dark:border-gray-700'
                    style={{
                      top: pageMarginCss,
                      left: pageMarginCss,
                      right: pageMarginCss,
                      bottom: pageMarginCss,
                    }}
                  />
                  <div
                    ref={contentAreaRef}
                    className='absolute'
                    style={{
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundImage: currentBackground?.url
                        ? `url(${currentBackground.url})`
                        : undefined,
                      backgroundSize: '100% 100%',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                    }}
                  >
                    {componentsForPage.length === 0 && !currentBackground?.url ? (
                      <div className='flex h-full w-full flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-[#dbdfe6] dark:border-[#dbdfe6] p-6'>
                        <div className='text-5xl text-[#c1c8d1] dark:text-[#c1c8d1]'>
                          []
                        </div>
                        <div className='flex max-w-sm flex-col items-center gap-2 text-center'>
                          <p className='text-[#111418] dark:text-[#111418] text-lg font-bold leading-tight tracking-[-0.015em]'>
                            Area de Design
                          </p>
                          <p className='text-[#60708a] dark:text-[#60708a] text-sm font-normal leading-normal'>
                            Arraste um componente da caixa de ferramentas para
                            comecar a montar sua Ordem de Servico.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={
                          layoutMode === 'free'
                            ? 'relative h-full w-full'
                            : 'w-full flex flex-wrap gap-4 items-start'
                        }
                      >
                        {componentsForPage.map((component) => {
                          const componentIndex =
                            componentIndexById.get(component.id) ?? 0;
                          return renderComponent(component, componentIndex);
                        })}
                        {layoutMode === 'free' && (
                          <div className='pointer-events-none absolute inset-0'>
                            {componentsForPage.map((component) => {
                              const handle = dragHandlePositions[component.id];
                              if (!handle?.clamped) return null;
                              return (
                                <button
                                  key={`drag-handle-${component.id}`}
                                  type='button'
                                  className='pointer-events-auto absolute flex items-center justify-center w-6 h-6 rounded border border-gray-200 bg-white/95 text-gray-500 shadow-sm hover:text-gray-700'
                                  style={{
                                    left: `${handle.x}px`,
                                    top: `${handle.y}px`,
                                    zIndex: 20,
                                  }}
                                  onPointerDown={(e) =>
                                    handleMoveStart(e, component.id)
                                  }
                                  title='Arraste para mover'
                                >
                                  <GripVertical className='w-4 h-4' />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              </div>
            </div>
          </div>

          <div className='pt-8'>
            <div className='flex flex-wrap items-center justify-between gap-3 pb-3'>
              <div>
                <h3 className='text-[#111418] dark:text-white text-sm font-semibold'>
                  Templates salvos
                </h3>
                <p className='text-[#60708a] dark:text-gray-400 text-xs'>
                  Somente templates salvos no banco aparecem aqui.
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Label htmlFor='template-filter' className='text-xs'>
                  Filtrar por vinculo
                </Label>
                <select
                  id='template-filter'
                  value={templateFilterClientId}
                  onChange={(e) => setTemplateFilterClientId(e.target.value)}
                  className='rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1 text-xs text-gray-700 dark:text-gray-200'
                >
                  <option value=''>Todos</option>
                  <option value='avulsa'>RAT avulsa</option>
                  {partnerClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {isLoadingTemplates ? (
              <div className='text-sm text-[#60708a] dark:text-gray-400'>
                Carregando templates...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className='rounded-lg border border-dashed border-[#e5e7eb] dark:border-gray-700 bg-white dark:bg-gray-900 p-6 text-center text-sm text-[#60708a] dark:text-gray-400'>
                Nenhum template salvo ainda. Use "Salvar Template" para adicionar.
              </div>
            ) : (
              <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    role='button'
                    tabIndex={0}
                    onClick={() =>
                      setConfirmDialog({ action: 'load', template })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setConfirmDialog({ action: 'load', template });
                      }
                    }}
                    className='text-left rounded-lg border border-[#e5e7eb] dark:border-gray-700 bg-white dark:bg-gray-900 p-4 hover:border-[#3880f5] hover:shadow-sm transition-all cursor-pointer'
                  >
                    <div className='flex items-center justify-between gap-2'>
                      <p className='text-[#111418] dark:text-white text-sm font-semibold'>
                        {template.name}
                      </p>
                      <div className='flex items-center gap-2'>
                        <span className='text-[10px] uppercase tracking-wide text-[#60708a] dark:text-gray-400'>
                          Salvo
                        </span>
                        {editingTemplateId === template.id && (
                          <span className='text-[10px] uppercase tracking-wide text-[#3880f5]'>
                            Editando
                          </span>
                        )}
                      </div>
                    </div>
                    <p className='mt-2 text-xs text-[#60708a] dark:text-gray-400'>
                      Clique para carregar no editor.
                    </p>
                    <div className='mt-3 flex items-center gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='h-8'
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmDialog({ action: 'load', template });
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='h-8 text-red-600 border-red-200 hover:bg-red-50'
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmDialog({ action: 'delete', template });
                        }}
                        disabled={deleteTemplateMutation.isPending}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
        </div>

        {/* Right Sidebar (Properties Panel) */}
        <aside className='flex h-full w-80 flex-col border-l border-[#e5e7eb] dark:border-gray-800 bg-white dark:bg-[#101722] overflow-y-auto'>
          <div className='p-4'>
            <h2 className='text-[#111418] dark:text-white text-[18px] font-bold leading-tight tracking-[-0.015em] pb-3 pt-1'>
              Propriedades
            </h2>
            {selectedComponent ? (
              <div className='space-y-4'>
                <div>
                  <Label htmlFor='label'>Rótulo</Label>
                  <Input
                    id='label'
                    value={selectedComponent.label}
                    onChange={(e) =>
                      updateComponent(selectedComponent.id, {
                        label: e.target.value,
                      })
                    }
                    className='mt-1'
                  />
                </div>

                {selectedComponent.type === 'logo' && (
                  <div className='space-y-3'>
                    <Label>Imagem do logo</Label>
                    <div className='flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3'>
                      {selectedComponent.logoUrl ? (
                        <img
                          src={selectedComponent.logoUrl}
                          alt={selectedComponent.label || 'Logo da Empresa'}
                          className='max-h-[110px] max-w-full object-contain'
                          draggable={false}
                        />
                      ) : (
                        <p className='text-xs text-gray-500'>
                          Nenhuma imagem enviada.
                        </p>
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleLogoUpload}
                    />
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                        ) : (
                          <Upload className='w-4 h-4 mr-2' />
                        )}
                        {selectedComponent.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                      </Button>
                      {selectedComponent.logoUrl && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            updateComponent(selectedComponent.id, {
                              logoUrl: undefined,
                              logoAssetId: undefined,
                            })
                          }
                        >
                          Remover imagem
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {selectedComponent.type !== 'divider' &&
                  selectedComponent.type !== 'logo' &&
                  selectedComponent.type !== 'signature' && (
                    <>
                      <div>
                        <Label htmlFor='placeholder'>Placeholder</Label>
                        <Input
                          id='placeholder'
                          value={selectedComponent.placeholder || ''}
                          onChange={(e) =>
                            updateComponent(selectedComponent.id, {
                              placeholder: e.target.value,
                            })
                          }
                          className='mt-1'
                        />
                      </div>

                      <div className='flex items-center justify-between'>
                        <Label htmlFor='required'>Obrigatório</Label>
                        <Switch
                          id='required'
                          checked={selectedComponent.required || false}
                          onCheckedChange={(checked) =>
                            updateComponent(selectedComponent.id, {
                              required: checked,
                            })
                          }
                        />
                      </div>

                      {FIELD_COMPONENT_TYPES.includes(
                        selectedComponent.type
                      ) && (
                        <div className='flex items-center justify-between'>
                          <Label htmlFor='showInput'>Mostrar campo</Label>
                          <Switch
                            id='showInput'
                            checked={selectedComponent.showInput !== false}
                            onCheckedChange={(checked) =>
                              updateComponent(selectedComponent.id, {
                                showInput: checked,
                              })
                            }
                          />
                        </div>
                      )}

                      {selectedComponent.type !== 'table' && (
                        <div>
                          <Label htmlFor='binding'>Vincular dados</Label>
                          <select
                            id='binding'
                            value={selectedComponent.binding || ''}
                            onChange={(e) =>
                              updateComponent(selectedComponent.id, {
                                binding: e.target.value,
                              })
                            }
                            className='mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200'
                          >
                            {bindingOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {[
                        'text',
                        'number',
                        'datetime',
                        'textarea',
                        'select',
                        'text-block',
                      ].includes(selectedComponent.type) && (
                        <div>
                          <Label htmlFor='defaultValue'>
                            {selectedComponent.type === 'text-block'
                              ? 'Texto'
                              : 'Valor padrao'}
                          </Label>
                          {selectedComponent.type === 'textarea' ||
                          selectedComponent.type === 'text-block' ? (
                            <Textarea
                              id='defaultValue'
                              value={selectedComponent.defaultValue || ''}
                              onChange={(e) =>
                                updateComponent(selectedComponent.id, {
                                  defaultValue: e.target.value,
                                })
                              }
                              className='mt-1'
                              rows={3}
                            />
                          ) : (
                            <Input
                              id='defaultValue'
                              value={selectedComponent.defaultValue || ''}
                              onChange={(e) =>
                                updateComponent(selectedComponent.id, {
                                  defaultValue: e.target.value,
                                })
                              }
                              className='mt-1'
                              placeholder='Valor exibido'
                            />
                          )}
                        </div>
                      )}

                      {selectedComponent.type === 'checkbox' && (
                        <div className='flex items-center justify-between'>
                          <Label htmlFor='defaultChecked'>
                            Marcado por padrao
                          </Label>
                          <Switch
                            id='defaultChecked'
                            checked={selectedComponent.defaultValue === 'true'}
                            onCheckedChange={(checked) =>
                              updateComponent(selectedComponent.id, {
                                defaultValue: checked ? 'true' : '',
                              })
                            }
                          />
                        </div>
                      )}

                    </>
                  )}

                <div className='grid grid-cols-2 gap-3'>
                  <div>
                    <Label htmlFor='width'>Largura</Label>
                    <Input
                      id='width'
                      value={selectedComponent.width || ''}
                      onChange={(e) => {
                        const normalized = normalizeSizeValue(
                          e.target.value,
                          ''
                        );
                        updateComponent(selectedComponent.id, {
                          width: normalized || undefined,
                        });
                      }}
                      placeholder='100% ou 320px'
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <Label htmlFor='height'>Altura</Label>
                    <Input
                      id='height'
                      value={selectedComponent.height || ''}
                      onChange={(e) => {
                        const normalized = normalizeSizeValue(
                          e.target.value,
                          ''
                        );
                        updateComponent(selectedComponent.id, {
                          height: normalized || undefined,
                        });
                      }}
                      placeholder='auto ou 120px'
                      className='mt-1'
                    />
                  </div>
                </div>
                {layoutMode === 'free' && (
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <Label htmlFor='pos-x'>Posicao X</Label>
                      <Input
                        id='pos-x'
                        type='number'
                        value={selectedComponent.x ?? 0}
                        onChange={(e) => {
                          const nextValue = Number.parseFloat(e.target.value);
                          updateComponent(selectedComponent.id, {
                            x: Number.isFinite(nextValue) ? nextValue : 0,
                          });
                        }}
                        className='mt-1'
                      />
                    </div>
                    <div>
                      <Label htmlFor='pos-y'>Posicao Y</Label>
                      <Input
                        id='pos-y'
                        type='number'
                        value={selectedComponent.y ?? 0}
                        onChange={(e) => {
                          const nextValue = Number.parseFloat(e.target.value);
                          updateComponent(selectedComponent.id, {
                            y: Number.isFinite(nextValue) ? nextValue : 0,
                          });
                        }}
                        className='mt-1'
                      />
                    </div>
                  </div>
                )}
                <div>
                  <Label htmlFor='rotation'>Rotacao (graus)</Label>
                  <Input
                    id='rotation'
                    type='number'
                    value={selectedComponent.rotation ?? 0}
                    onChange={(e) => {
                      const nextValue = Number.parseFloat(e.target.value);
                      updateComponent(selectedComponent.id, {
                        rotation: Number.isFinite(nextValue) ? nextValue : 0,
                      });
                    }}
                    className='mt-1'
                  />
                </div>

                {selectedComponent.type === 'select' && (
                  <div>
                    <Label htmlFor='options'>Opções (uma por linha)</Label>
                    <Textarea
                      id='options'
                      value={selectedComponent.options?.join('\n') || ''}
                      onChange={(e) => {
                        const options = e.target.value
                          .split('\n')
                          .filter((opt) => opt.trim());
                        updateComponent(selectedComponent.id, { options });
                      }}
                      className='mt-1'
                      rows={4}
                    />
                  </div>
                )}

                {selectedComponent.type === 'textarea' && (
                  <div>
                    <Label htmlFor='rows'>Número de Linhas</Label>
                    <Input
                      id='rows'
                      type='number'
                      min='2'
                      max='20'
                      value={selectedComponent.rows || 4}
                      onChange={(e) =>
                        updateComponent(selectedComponent.id, {
                          rows: parseInt(e.target.value) || 4,
                        })
                      }
                      className='mt-1'
                    />
                  </div>
                )}

                <Button
                  variant='destructive'
                  size='sm'
                  className='w-full'
                  onClick={() => {
                    deleteComponent(selectedComponent.id);
                    setSelectedComponent(null);
                  }}
                >
                  <Trash2 className='w-4 h-4 mr-2' />
                  Remover Componente
                </Button>
              </div>
            ) : (
              <div className='flex flex-col items-center justify-center rounded-lg bg-[#f5f7f8] dark:bg-gray-900 p-10 text-center'>
                <div className='text-4xl text-[#c1c8d1] dark:text-gray-600 mb-2'>
                  🖱️
                </div>
                <p className='text-[#60708a] dark:text-gray-400 text-sm font-normal mt-2'>
                  Selecione um componente na área de design para ver suas
                  propriedades.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className='max-w-6xl max-h-[90vh] overflow-auto'>
          <DialogHeader>
            <DialogTitle>Pré-visualização - {templateName}</DialogTitle>
            <DialogDescription>
              Esta é uma pré-visualização de como o template aparecerá quando
              preenchido.
            </DialogDescription>
          </DialogHeader>
          <div className='mt-4 space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-[#60708a] dark:text-gray-400'>
              <span>
                Pagina {currentPage + 1} de {pageCount}
              </span>
              {currentBackground?.url && <span>Comparacao do modelo</span>}
            </div>
            <h2 className='text-2xl font-bold'>{templateName}</h2>
            {currentBackground?.url ? (
              <div className='flex flex-nowrap items-start justify-center gap-6'>
                <div className='flex flex-col items-center gap-2'>
                  <span className='inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-base font-bold tracking-wide text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'>
                    Original
                  </span>
                  {renderPreviewPage(false, true)}
                </div>
                <div className='flex flex-col items-center gap-2'>
                  <span className='inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-base font-bold tracking-wide text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'>
                    Editado
                  </span>
                  {renderPreviewPage(true, false)}
                </div>
              </div>
            ) : (
              renderPreviewPage(true, false)
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirmDialog}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
          }
        }}
      >
        <AlertDialogContent className='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-[#111418] dark:text-white text-xl font-bold'>
              {confirmDialog?.action === 'delete' && 'Excluir template?'}
              {confirmDialog?.action === 'load' && 'Carregar template?'}
              {confirmDialog?.action === 'publish' && 'Salvar template?'}
              {confirmDialog?.action === 'draft' && 'Salvar rascunho?'}
            </AlertDialogTitle>
            <AlertDialogDescription className='text-[#60708a] dark:text-gray-400 text-sm'>
              {confirmDialog?.action === 'delete' &&
                `O template "${confirmDialog?.template?.name}" sera removido e nao podera ser recuperado.`}
              {confirmDialog?.action === 'load' &&
                `O layout atual sera substituido por "${confirmDialog?.template?.name}". Deseja continuar?`}
              {confirmDialog?.action === 'publish' && (
                <>
                  {`Nome: ${confirmDialog?.trimmedName || templateName.trim()}`}
                  <br />
                  {`Vinculo: ${
                    templateScope === 'client'
                      ? 'Empresa parceira'
                      : 'RAT avulsa'
                  }`}
                  {templateScope === 'client' && (
                    <>
                      <br />
                      {`Empresa: ${
                        partnerClients.find(
                          (client) => client.id === selectedPartnerClientId
                        )?.name || 'Empresa nao selecionada'
                      }`}
                    </>
                  )}
                  <br />
                  Template salvo fica disponivel para uso nos chamados.
                </>
              )}
              {confirmDialog?.action === 'draft' &&
                'O rascunho fica so no editor e nao aparece na criacao de chamados.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className='flex justify-end gap-3 pt-4 border-t dark:border-gray-700'>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmDialog?.action === 'delete'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : ''
              }
            >
              {confirmDialog?.action === 'delete' && 'Excluir'}
              {confirmDialog?.action === 'load' && 'Carregar'}
              {confirmDialog?.action === 'publish' && 'Salvar'}
              {confirmDialog?.action === 'draft' && 'Salvar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
