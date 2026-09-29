import type { ReactNode } from 'react'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="relative flex min-h-dvh w-full flex-1 items-center justify-center px-6 py-10 lg:w-1/2">
        <img
          src="/logo.png"
          alt="DEOS"
          className="absolute top-6 left-6 h-12 w-auto"
        />
        {children}
      </div>
      <div className="relative hidden min-h-dvh w-1/2 lg:block">
        <img
          src="/background-image.png"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  )
}
