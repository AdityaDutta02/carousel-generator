import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background px-6 py-3 flex items-center gap-6 shrink-0">
        <span className="font-semibold text-sm">Carousel Generator</span>
        <nav className="flex items-center gap-1">
          <Link href="/carousels" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Carousels
          </Link>
          <Link href="/templates" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Templates
          </Link>
        </nav>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
