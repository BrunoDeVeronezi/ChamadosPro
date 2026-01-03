import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent,
} from 'react';

export interface SignaturePadHandle {
  clear: () => void;
}

interface SignaturePadProps {
  value?: string | null;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  height?: number;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ value, onChange, disabled, height = 180 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);

    const drawFromValue = (dataUrl?: string | null) => {
      if (!dataUrl) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = dataUrl;
    };

    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      const width = parent?.clientWidth || 400;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827';
      }
      drawFromValue(value);
    };

    useEffect(() => {
      setupCanvas();
      window.addEventListener('resize', setupCanvas);
      return () => window.removeEventListener('resize', setupCanvas);
    }, [value, height]);

    const getPointerPosition = (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawingRef.current = true;
      const { x, y } = getPointerPosition(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
      if (disabled || !drawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPointerPosition(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handlePointerUp = () => {
      if (disabled || !drawingRef.current) return;
      drawingRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    };

    const clear = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onChange('');
    };

    useImperativeHandle(ref, () => ({ clear }));

    return (
      <div className='w-full'>
        <canvas
          ref={canvasRef}
          className='w-full rounded-md border border-dashed border-gray-300 bg-white'
          style={{ touchAction: 'none', opacity: disabled ? 0.6 : 1 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
