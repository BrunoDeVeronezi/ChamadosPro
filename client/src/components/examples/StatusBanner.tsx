import { StatusBanner } from '../status-banner';

export default function StatusBannerExample() {
  return (
    <div className="space-y-0">
      <StatusBanner
        variant="warning"
        title="Google Calendar no vinculado"
        message="Conecte sua conta do Google para sincronizar automaticamente seus agendamentos."
        actionLabel="Conectar agora"
        onAction={() => console.log('Connect Google Calendar')}
        dismissible
      />
      <StatusBanner
        variant="error"
        title="Cota do Google Calendar excedida"
        message="Voc atingiu o limite de requisies. Tente novamente mais tarde."
        actionLabel="Saiba mais"
        onAction={() => console.log('Learn more')}
      />
      <StatusBanner
        variant="success"
        title="Google Calendar conectado"
        message="Seus agendamentos esto sendo sincronizados automaticamente."
        dismissible
      />
    </div>
  );
}
