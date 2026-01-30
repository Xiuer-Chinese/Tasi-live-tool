export function Title({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1
        className="text-2xl font-semibold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </div>
  )
}
