import { AppShell } from '@/components/shell/app-shell';

export const runtime = 'edge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
