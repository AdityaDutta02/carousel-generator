'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { login, isLoading, error } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch {
      // error state is set by useAuth
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="email-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="password-input"
              />
            </div>
            {error && <p className="text-red-400 text-sm" data-testid="error-message">{error}</p>}
            <Button type="submit" disabled={isLoading} className="w-full" data-testid="submit-button">
              {isLoading ? 'Signing in\u2026' : 'Sign in'}
            </Button>
            <p className="text-zinc-500 text-sm text-center">
              No account?{' '}
              <Link href="/register" className="text-zinc-300 hover:underline">Register</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
