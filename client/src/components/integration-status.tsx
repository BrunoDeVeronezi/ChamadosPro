import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Calendar } from "lucide-react";

type IntegrationStatus = "connected" | "not_connected" | "error" | "pending";

interface Integration {
  name: string;
  status: IntegrationStatus;
  icon: React.ElementType;
  description: string;
}

const statusConfig = {
  connected: {
    label: "Conectado",
    variant: "secondary" as const,
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400"
  },
  not_connected: {
    label: "No Conectado",
    variant: "outline" as const,
    icon: XCircle,
    color: "text-muted-foreground"
  },
  error: {
    label: "Erro",
    variant: "destructive" as const,
    icon: AlertCircle,
    color: "text-destructive"
  },
  pending: {
    label: "Pendente",
    variant: "outline" as const,
    icon: AlertCircle,
    color: "text-amber-600 dark:text-amber-400"
  }
};

interface IntegrationStatusProps {
  integrations: Integration[];
}

export function IntegrationStatus({ integrations }: IntegrationStatusProps) {
  const [, setLocation] = useLocation();

  const handleConnect = () => {
    setLocation("/configuracoes");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Status das Integraes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {integrations.map((integration) => {
          const config = statusConfig[integration.status];
          const StatusIcon = config.icon;
          const IntegrationIcon = integration.icon;

          return (
            <div
              key={integration.name}
              className="flex items-center justify-between p-4 border rounded-lg"
              data-testid={`integration-${integration.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center gap-3">
                <div className={`${config.color}`}>
                  <IntegrationIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{integration.name}</h4>
                    <Badge variant={config.variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {integration.description}
                  </p>
                </div>
              </div>
              {integration.status !== "connected" && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  data-testid="button-connect-integration"
                  onClick={handleConnect}
                >
                  Conectar
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
