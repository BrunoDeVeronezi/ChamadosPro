import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoreHorizontal, User, Building2 } from "lucide-react";

interface Client {
  id: string;
  name: string;
  type: "PF" | "PJ";
  email: string;
  phone: string;
  city: string;
  state: string;
}

interface ClientListProps {
  clients: Client[];
}

export function ClientList({ clients }: ClientListProps) {
  if (clients.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum cliente cadastrado</h3>
          <p className="text-sm text-muted-foreground">
            Comece adicionando seu primeiro cliente
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {clients.map((client) => (
        <Card key={client.id} className="hover-elevate" data-testid={`card-client-${client.id}`}>
          <div className="p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {client.type === "PF" ? (
                  <User className="h-5 w-5 text-primary" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold truncate" data-testid="text-client-name">{client.name}</h3>
                  <Badge variant="outline" className="flex-shrink-0">
                    {client.type}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span data-testid="text-client-email">{client.email}</span>
                  <span>{client.phone}</span>
                  <span>{client.city} - {client.state}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" data-testid="button-client-menu">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
