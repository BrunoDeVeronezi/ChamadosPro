import { MetricCard } from '../metric-card';
import { DollarSign, Users, CheckCircle2, Calendar } from 'lucide-react';

export default function MetricCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
      <MetricCard
        label="Valores a Receber"
        value="R$ 12.450"
        change={12.5}
        icon={DollarSign}
      />
      <MetricCard
        label="Chamados Ativos"
        value="24"
        icon={Calendar}
        subtitle="8 pendentes"
      />
      <MetricCard
        label="Clientes Ativos"
        value="87"
        change={-3.2}
        icon={Users}
      />
      <MetricCard
        label="Concludos (ms)"
        value="156"
        change={18.1}
        icon={CheckCircle2}
      />
    </div>
  );
}
