import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

type MasterAdminStats = {
  totalTechnicians: number;
  totalCompanies: number;
  totalUsers: number;
  activeSubscriptions: number;
  databaseSize: number;
  databaseCapacity: number;
};

type ApiKeyStatus = 'active' | 'pending' | 'revoked';

type ApiKeyItem = {
  id: string;
  service: string;
  key: string;
  status: ApiKeyStatus;
  lastUpdated: string;
};

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'api-keys', label: 'API keys' },
];

const statItems: Array<{
  label: string;
  key: keyof MasterAdminStats;
}> = [
  { label: 'Total users', key: 'totalUsers' },
  { label: 'Companies', key: 'totalCompanies' },
  { label: 'Technicians', key: 'totalTechnicians' },
  { label: 'Active subscriptions', key: 'activeSubscriptions' },
];

const formatNumber = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString() : '--';

const formatBytes = (value?: number) => {
  if (!value || value <= 0 || !Number.isFinite(value)) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const decimals = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
};

const getStatusVariant = (status: ApiKeyStatus) => {
  if (status === 'active') return 'default';
  if (status === 'pending') return 'secondary';
  return 'destructive';
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return 'Unexpected error. Please try again.';
};

export default function MasterAdmin() {
  const { user, logout } = useAuth();

  const statsQuery = useQuery<MasterAdminStats>({
    queryKey: ['/api/master-admin/stats'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/master-admin/stats',
        undefined
      );
      return response.json();
    },
  });

  const apiKeysQuery = useQuery<ApiKeyItem[]>({
    queryKey: ['/api/master-admin/api-keys'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        '/api/master-admin/api-keys',
        undefined
      );
      return response.json();
    },
  });

  const stats = statsQuery.data;
  const dbUsage =
    stats && stats.databaseCapacity > 0
      ? Math.min(100, (stats.databaseSize / stats.databaseCapacity) * 100)
      : 0;

  return (
    <div className='min-h-screen bg-muted/40 text-foreground'>
      <div className='flex min-h-screen flex-col lg:flex-row'>
        <aside className='border-b bg-background lg:w-64 lg:border-b-0 lg:border-r'>
          <div className='space-y-6 p-6'>
            <div className='space-y-1'>
              <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
                Master Admin
              </p>
              <h1 className='text-xl font-semibold'>Control Center</h1>
            </div>
            <nav className='space-y-1'>
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className='block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground'
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className='space-y-2 border-t pt-4'>
              <p className='text-xs uppercase tracking-[0.2em] text-muted-foreground'>
                Signed in
              </p>
              <p className='text-sm font-semibold'>
                {user?.email || 'Unknown user'}
              </p>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='w-full'
                onClick={logout}
              >
                Sign out
              </Button>
            </div>
          </div>
        </aside>

        <main className='flex-1 space-y-8 p-6'>
          <header className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-3xl font-semibold'>System overview</h2>
              <p className='text-sm text-muted-foreground'>
                Monitor core metrics and keep integrations in sync.
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => statsQuery.refetch()}
              disabled={statsQuery.isFetching}
            >
              {statsQuery.isFetching ? 'Refreshing...' : 'Refresh stats'}
            </Button>
          </header>

          <section id='overview' className='space-y-4'>
            {statsQuery.error && (
              <Alert variant='destructive'>
                <AlertTitle>Stats unavailable</AlertTitle>
                <AlertDescription>
                  {formatErrorMessage(statsQuery.error)}
                </AlertDescription>
              </Alert>
            )}

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
              {statsQuery.isLoading
                ? statItems.map((item) => (
                    <Card key={item.key}>
                      <CardHeader className='space-y-2'>
                        <Skeleton className='h-4 w-32' />
                        <Skeleton className='h-8 w-24' />
                      </CardHeader>
                    </Card>
                  ))
                : statItems.map((item) => (
                    <Card key={item.key}>
                      <CardHeader className='space-y-2'>
                        <CardDescription>{item.label}</CardDescription>
                        <CardTitle className='text-3xl'>
                          {formatNumber(stats?.[item.key])}
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
            </div>

            <Card>
              <CardHeader className='space-y-2'>
                <CardTitle className='text-lg'>Database usage</CardTitle>
                <CardDescription>
                  Estimated usage based on active records.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Progress value={Math.round(dbUsage)} />
                <div className='flex flex-col gap-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between'>
                  <span>
                    {formatBytes(stats?.databaseSize)} used
                  </span>
                  <span>
                    {formatBytes(stats?.databaseCapacity)} capacity
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id='api-keys' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>API keys</CardTitle>
                <CardDescription>
                  Review integration credentials and status.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {apiKeysQuery.error && (
                  <Alert variant='destructive'>
                    <AlertTitle>API keys unavailable</AlertTitle>
                    <AlertDescription>
                      {formatErrorMessage(apiKeysQuery.error)}
                    </AlertDescription>
                  </Alert>
                )}
                {apiKeysQuery.isLoading ? (
                  <div className='space-y-3'>
                    {[1, 2, 3].map((item) => (
                      <div key={item} className='space-y-2'>
                        <Skeleton className='h-4 w-32' />
                        <Skeleton className='h-3 w-56' />
                      </div>
                    ))}
                  </div>
                ) : apiKeysQuery.data && apiKeysQuery.data.length > 0 ? (
                  <div className='divide-y rounded-lg border border-muted'>
                    {apiKeysQuery.data.map((apiKey) => (
                      <div
                        key={apiKey.id}
                        className='flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between'
                      >
                        <div>
                          <p className='font-medium'>{apiKey.service}</p>
                          <p className='text-sm text-muted-foreground'>
                            {apiKey.key}
                          </p>
                        </div>
                        <div className='flex items-center gap-3'>
                          <Badge variant={getStatusVariant(apiKey.status)}>
                            {apiKey.status.toUpperCase()}
                          </Badge>
                          <span className='text-xs text-muted-foreground'>
                            Updated {new Date(apiKey.lastUpdated).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No API keys returned.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
