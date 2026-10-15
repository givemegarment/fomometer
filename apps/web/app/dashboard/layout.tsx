import { Sidebar } from '@/components/dashboard/sidebar';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { TopBar } from '@/components/dashboard/topbar';
import { DisclaimerRibbon } from '@/components/disclaimer-ribbon';

export const runtime = 'edge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex flex-1 flex-col px-3 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-8 lg:px-8">
          <main className="flex-1">{children}</main>
          <div className="mt-10">
            <DisclaimerRibbon />
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
