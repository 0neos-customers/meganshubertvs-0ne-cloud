import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export default function RequestAccessPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ShieldAlert className="h-8 w-8 text-primary" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-heading font-bold">Invite Required</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
          This workspace is invite-only. If you received an invite, check your
          email for the sign-up link.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  )
}
