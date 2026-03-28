'use client'

import { useState, useEffect } from 'react'
import { useSignIn, useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Input, Label } from '@0ne/ui'
import { Loader2, AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { OAuthButtons } from '../../_components/oauth-buttons'

type SignInStep = 'credentials' | 'second_factor'

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const { isSignedIn } = useAuth()
  const router = useRouter()

  const [step, setStep] = useState<SignInStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // If user already has an active session, redirect them away
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace('/')
    }
  }, [isLoaded, isSignedIn, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !signIn) return

    setLoading(true)
    setError('')

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === 'complete') {
        await activateSession(result.createdSessionId!)
      } else if (result.status === 'needs_second_factor') {
        // Clerk requires a second factor (email code, TOTP, etc.)
        // Prepare the email code verification
        await signIn.prepareSecondFactor({
          strategy: 'email_code',
        })
        setStep('second_factor')
      } else if (result.status === 'needs_identifier') {
        setError('Please enter your email address.')
      } else if (result.status === 'needs_first_factor') {
        setError('Please enter your password.')
      } else {
        setError(`Unexpected sign-in status: ${result.status}. Please contact support.`)
      }
    } catch (err: unknown) {
      handleClerkError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !signIn) return

    setLoading(true)
    setError('')

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: verificationCode,
      })

      if (result.status === 'complete') {
        await activateSession(result.createdSessionId!)
      } else {
        setError(`Verification incomplete (status: ${result.status}). Please try again.`)
      }
    } catch (err: unknown) {
      handleClerkError(err)
    } finally {
      setLoading(false)
    }
  }

  const activateSession = async (sessionId: string) => {
    try {
      await setActive!({ session: sessionId })
      router.push('/')
    } catch (sessionErr) {
      console.error('[sign-in] Failed to activate session:', sessionErr)
      setError('Sign-in succeeded but session activation failed. This domain may not be configured for authentication yet.')
    }
  }

  const handleClerkError = (err: unknown) => {
    const clerkError = err as { errors?: { message: string; code?: string }[] }
    const firstError = clerkError.errors?.[0]
    if (firstError?.code === 'form_password_incorrect') {
      setError('Incorrect password. Please try again.')
    } else if (firstError?.code === 'form_identifier_not_found') {
      setError('No account found with this email address.')
    } else if (firstError?.code === 'form_code_incorrect') {
      setError('Incorrect verification code. Please check your email and try again.')
    } else {
      setError(firstError?.message || 'Sign-in failed. Please try again.')
    }
  }

  // ── Second Factor Step ──────────────────────────────────────────────
  if (step === 'second_factor') {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => { setStep('credentials'); setError(''); setVerificationCode('') }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <h2 className="text-2xl font-heading font-bold">Check your email</h2>
          <p className="text-muted-foreground mt-1">
            We sent a verification code to <strong>{email}</strong>
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value)}
              placeholder="Enter 6-digit code"
              required
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify & Sign In
          </Button>
        </form>
      </div>
    )
  }

  // ── Credentials Step ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-heading font-bold">Welcome back</h2>
        <p className="text-muted-foreground mt-1">
          Sign in to your 0ne account
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <OAuthButtons mode="sign-in" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/sign-in/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="text-primary hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </div>
  )
}
