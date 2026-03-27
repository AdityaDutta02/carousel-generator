export default async function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="p-8">
      <p className="text-zinc-500">Builder for carousel {id} — coming in Plan 2</p>
    </div>
  )
}
