"use client"

export function SectionSurface({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--editor-bg)] p-8">
      <div className="max-w-md text-center">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
