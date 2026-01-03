import { useAuth } from '@/hooks/use-auth';

interface ChamadosProLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  // Props para customização do tenant
  customLogoUrl?: string | null;
  customName?: string | null;
}

export function ChamadosProLogo({
  size = 64,
  showText = true,
  className = '',
  customLogoUrl,
  customName,
}: ChamadosProLogoProps) {
  const halfSize = size / 2;
  const borderRadius = size * 0.2; // 20% do tamanho para bordas arredondadas

  // Se o tenant tiver logo customizado, usar imagem
  if (customLogoUrl && customLogoUrl.trim() !== '') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <img
          src={customLogoUrl}
          alt={customName || 'Logo'}
          className='rounded-2xl object-contain'
          style={{ width: size, height: size }}
        />
        {showText && (
          <div className='mt-3 flex items-baseline gap-1'>
            <span className='text-gray-700 dark:text-gray-300 text-xl font-bold'>
              {customName || 'Chamados'}
            </span>
            {!customName && (
              <span className='text-[#60A5FA] text-xl font-bold'>Pro</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo com 4 quadrantes */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className='rounded-2xl'
      >
        {/* Fundo branco arredondado */}
        <rect width={size} height={size} rx={borderRadius} fill='white' />

        {/* Quadrante superior esquerdo - Azul claro com balão de fala */}
        <g>
          <rect
            x='0'
            y='0'
            width={halfSize}
            height={halfSize}
            rx={borderRadius}
            fill='#60A5FA'
          />
          {/* Ícone de balão de fala com 3 linhas */}
          <g transform={`translate(${halfSize * 0.5}, ${halfSize * 0.5})`}>
            {/* Balão */}
            <rect
              x={-halfSize * 0.2}
              y={-halfSize * 0.15}
              width={halfSize * 0.4}
              height={halfSize * 0.3}
              rx={halfSize * 0.03}
              fill='white'
            />
            {/* 3 linhas horizontais */}
            <line
              x1={-halfSize * 0.15}
              y1={-halfSize * 0.08}
              x2={halfSize * 0.15}
              y2={-halfSize * 0.08}
              stroke='#60A5FA'
              strokeWidth={halfSize * 0.02}
            />
            <line
              x1={-halfSize * 0.15}
              y1='0'
              x2={halfSize * 0.15}
              y2='0'
              stroke='#60A5FA'
              strokeWidth={halfSize * 0.02}
            />
            <line
              x1={-halfSize * 0.15}
              y1={halfSize * 0.08}
              x2={halfSize * 0.15}
              y2={halfSize * 0.08}
              stroke='#60A5FA'
              strokeWidth={halfSize * 0.02}
            />
          </g>
        </g>

        {/* Quadrante superior direito - Laranja com ícones */}
        <g>
          <rect
            x={halfSize}
            y='0'
            width={halfSize}
            height={halfSize}
            rx={borderRadius}
            fill='#FB923C'
          />
          {/* Ícones: engrenagem, servidor, cifrão */}
          <g transform={`translate(${halfSize * 1.5}, ${halfSize * 0.5})`}>
            {/* Engrenagem */}
            <circle
              cx={-halfSize * 0.15}
              cy={-halfSize * 0.1}
              r={halfSize * 0.08}
              fill='white'
            />
            <circle
              cx={-halfSize * 0.15}
              cy={-halfSize * 0.1}
              r={halfSize * 0.05}
              fill='#FB923C'
            />
            {/* Servidor (rack) */}
            <rect
              x={halfSize * 0.05}
              y={-halfSize * 0.12}
              width={halfSize * 0.12}
              height={halfSize * 0.18}
              fill='white'
              rx={halfSize * 0.02}
            />
            <line
              x1={halfSize * 0.08}
              y1={-halfSize * 0.08}
              x2={halfSize * 0.14}
              y2={-halfSize * 0.08}
              stroke='#FB923C'
              strokeWidth={halfSize * 0.015}
            />
            <line
              x1={halfSize * 0.08}
              y1={-halfSize * 0.03}
              x2={halfSize * 0.14}
              y2={-halfSize * 0.03}
              stroke='#FB923C'
              strokeWidth={halfSize * 0.015}
            />
            {/* Cifrão */}
            <text
              x={halfSize * 0.25}
              y={halfSize * 0.05}
              fill='white'
              fontSize={halfSize * 0.15}
              fontWeight='bold'
              fontFamily='Arial, sans-serif'
            >
              $
            </text>
          </g>
        </g>

        {/* Quadrante inferior esquerdo - Azul escuro com silhueta e texto "Clientes" */}
        <g>
          <rect
            x='0'
            y={halfSize}
            width={halfSize}
            height={halfSize}
            rx={borderRadius}
            fill='#1E40AF'
          />
          {/* Silhueta de pessoa (cabeça e ombros) */}
          <g transform={`translate(${halfSize * 0.5}, ${halfSize * 1.3})`}>
            {/* Cabeça */}
            <circle
              cx='0'
              cy={-halfSize * 0.1}
              r={halfSize * 0.1}
              fill='white'
            />
            {/* Ombros */}
            <path
              d={`M ${-halfSize * 0.15} ${halfSize * 0.05} Q 0 ${
                halfSize * 0.12
              } ${halfSize * 0.15} ${halfSize * 0.05}`}
              stroke='white'
              strokeWidth={halfSize * 0.04}
              fill='white'
              strokeLinecap='round'
            />
          </g>
          {/* Texto "Clientes" */}
          <text
            x={halfSize * 0.5}
            y={halfSize * 1.65}
            fill='white'
            fontSize={halfSize * 0.14}
            fontWeight='600'
            textAnchor='middle'
            fontFamily='Arial, sans-serif'
          >
            Clientes
          </text>
        </g>

        {/* Quadrante inferior direito - Verde com gráfico de barras */}
        <g>
          <rect
            x={halfSize}
            y={halfSize}
            width={halfSize}
            height={halfSize}
            rx={borderRadius}
            fill='#10B981'
          />
          {/* Gráfico de barras com seta para cima */}
          <g transform={`translate(${halfSize * 1.5}, ${halfSize * 1.4})`}>
            {/* Barras do gráfico */}
            <rect
              x={-halfSize * 0.2}
              y={-halfSize * 0.1}
              width={halfSize * 0.08}
              height={halfSize * 0.2}
              fill='white'
              rx={halfSize * 0.01}
            />
            <rect
              x={-halfSize * 0.08}
              y={-halfSize * 0.06}
              width={halfSize * 0.08}
              height={halfSize * 0.16}
              fill='white'
              rx={halfSize * 0.01}
            />
            <rect
              x={halfSize * 0.04}
              y={-halfSize * 0.14}
              width={halfSize * 0.08}
              height={halfSize * 0.24}
              fill='white'
              rx={halfSize * 0.01}
            />
            {/* Seta para cima */}
            <path
              d={`M ${halfSize * 0.1} ${halfSize * 0.05} L ${halfSize * 0.15} ${
                -halfSize * 0.05
              } L ${halfSize * 0.2} ${halfSize * 0.05}`}
              stroke='white'
              strokeWidth={halfSize * 0.025}
              fill='none'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </g>
        </g>

        {/* Anel central branco com contorno azul claro */}
        <circle
          cx={halfSize}
          cy={halfSize}
          r={halfSize * 0.15}
          fill='white'
          stroke='#60A5FA'
          strokeWidth={halfSize * 0.02}
        />
      </svg>

      {/* Texto "Chamados Pro" ou nome customizado */}
      {showText && (
        <div className='mt-3 flex items-baseline gap-1'>
          <span className='text-gray-700 dark:text-gray-300 text-xl font-bold'>
            {customName || 'Chamados'}
          </span>
          {!customName && (
            <span className='text-[#60A5FA] text-xl font-bold'>Pro</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente wrapper que automaticamente usa logo e nome do tenant se disponíveis
 * Usa o logo padrão do Chamados Pro se o tenant não tiver configurações customizadas
 */
export function TenantLogo(
  props: Omit<ChamadosProLogoProps, 'customLogoUrl' | 'customName'>
) {
  const { user } = useAuth();

  return (
    <ChamadosProLogo
      {...props}
      customLogoUrl={user?.companyLogoUrl}
      customName={user?.companyName}
    />
  );
}
