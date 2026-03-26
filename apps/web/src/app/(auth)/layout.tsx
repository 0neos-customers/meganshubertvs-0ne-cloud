import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1C1B19] text-white flex-col justify-between p-12">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          <span className="text-[#FF692D]">0</span>ne
        </Link>
        <div className="space-y-6">
          <h1 className="text-4xl font-heading leading-tight">
            Your Personal AI<br />Infrastructure
          </h1>
          <p className="text-lg text-white/60 max-w-md">
            One system. Every tool. Built around you.
          </p>
        </div>
        <p className="text-sm text-white/30">
          {process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'your-app.vercel.app'}
        </p>
      </div>

      {/* Right panel - Auth form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="text-3xl font-bold tracking-tight">
              <span className="text-primary">0</span>ne
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
