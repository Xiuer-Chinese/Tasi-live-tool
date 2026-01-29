export function Title({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </div>
  )
}
