'use client'
import { useState, useEffect, useCallback } from 'react'
import { getPocketBase } from '@/lib/pocketbase'

export interface AuthUser {
  id: string
  email: string
  display_name: string
  role: 'user' | 'admin'
  brand_name?: string
  handle?: string
  accent_color?: string
  tone?: string
  target_audience?: string
  platform_preference?: string
}

type PbClient = ReturnType<typeof getPocketBase>

function getAuthUser(pb: PbClient): AuthUser | null {
  return pb.authStore.isValid ? (pb.authStore.model as unknown as AuthUser) : null
}

async function runWithLoading(
  action: () => Promise<void>,
  errorMessage: string,
  setIsLoading: (v: boolean) => void,
  setError: (msg: string | null) => void
): Promise<void> {
  setIsLoading(true)
  setError(null)
  try {
    await action()
  } catch (e) {
    setError(errorMessage)
    throw e
  } finally {
    setIsLoading(false)
  }
}

export function useAuth() {
  const pb = getPocketBase()
  const [user, setUser] = useState<AuthUser | null>(() => getAuthUser(pb))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return pb.authStore.onChange(() => {
      setUser(getAuthUser(pb))
    })
  }, [pb])

  const login = useCallback(
    (email: string, password: string): Promise<void> =>
      runWithLoading(
        () => pb.collection('users').authWithPassword(email, password).then(() => undefined),
        'Invalid email or password',
        setIsLoading,
        setError
      ),
    [pb]
  )

  const register = useCallback(
    (email: string, password: string): Promise<void> =>
      runWithLoading(
        async () => {
          await pb.collection('users').create({
            email,
            password,
            passwordConfirm: password,
            role: 'user',
          })
          await pb.collection('users').authWithPassword(email, password)
        },
        'Registration failed. Email may already be in use.',
        setIsLoading,
        setError
      ),
    [pb]
  )

  const logout = useCallback(() => {
    pb.authStore.clear()
  }, [pb])

  return { user, isLoading, error, login, register, logout }
}
