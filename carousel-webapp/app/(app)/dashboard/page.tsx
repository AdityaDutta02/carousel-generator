import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">My Carousels</h1>
        <Link href="/generate">
          <Button>New Carousel</Button>
        </Link>
      </div>
      <p className="text-zinc-500">No carousels yet. Create your first one.</p>
    </div>
  )
}
