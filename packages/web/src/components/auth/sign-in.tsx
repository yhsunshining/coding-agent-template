import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GitHubIcon } from '@/components/icons/github-icon'
import { useState } from 'react'
import { getEnabledAuthProviders } from '@/lib/auth/providers'

type LocalMode = 'login' | 'register'

export function SignIn() {
  const [showDialog, setShowDialog] = useState(false)
  const [loadingGitHub, setLoadingGitHub] = useState(false)

  // Local auth state
  const [localMode, setLocalMode] = useState<LocalMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [loadingLocal, setLoadingLocal] = useState(false)

  const { github: hasGitHub, local: hasLocal } = getEnabledAuthProviders()

  const handleGitHubSignIn = () => {
    setLoadingGitHub(true)
    window.location.href = '/api/auth/signin/github'
  }

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setLoadingLocal(true)
    try {
      const endpoint = localMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLocalError(data.error || 'An error occurred')
      } else {
        window.location.reload()
      }
    } catch {
      setLocalError('Network error, please try again')
    } finally {
      setLoadingLocal(false)
    }
  }

  const Spinner = () => (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )

  return (
    <>
      <Button onClick={() => setShowDialog(true)} variant="outline" size="sm">
        Sign in
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in</DialogTitle>
            <DialogDescription>
              {hasGitHub && hasLocal
                ? 'Sign in with GitHub or a local account.'
                : hasGitHub
                  ? 'Sign in with GitHub to continue.'
                  : 'Sign in with a local account to continue.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            {/* GitHub sign-in (disabled)
            {hasGitHub && (
              <Button
                onClick={handleGitHubSignIn}
                disabled={loadingGitHub || loadingLocal}
                variant="outline"
                size="lg"
                className="w-full"
              >
                {loadingGitHub ? (
                  <>
                    <Spinner />
                    Loading...
                  </>
                ) : (
                  <>
                    <GitHubIcon className="h-4 w-4 mr-2" />
                    Sign in with GitHub
                  </>
                )}
              </Button>
            )}
            */}

            {/* Divider (disabled)
            {hasGitHub && hasLocal && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
            )}
            */}

            {/* Local account */}
            {hasLocal && (
              <form onSubmit={handleLocalSubmit} className="flex flex-col gap-3">
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    className={`font-medium ${localMode === 'login' ? 'text-foreground underline' : 'text-muted-foreground'}`}
                    onClick={() => {
                      setLocalMode('login')
                      setLocalError('')
                    }}
                  >
                    Login
                  </button>
                  <span className="text-muted-foreground">/</span>
                  <button
                    type="button"
                    className={`font-medium ${localMode === 'register' ? 'text-foreground underline' : 'text-muted-foreground'}`}
                    onClick={() => {
                      setLocalMode('register')
                      setLocalError('')
                    }}
                  >
                    Register
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="username"
                    required
                    minLength={3}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete={localMode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                  />
                </div>

                {localError && <p className="text-sm text-destructive">{localError}</p>}

                <Button type="submit" disabled={loadingLocal || loadingGitHub} size="lg" className="w-full">
                  {loadingLocal ? (
                    <>
                      <Spinner />
                      Loading...
                    </>
                  ) : localMode === 'login' ? (
                    'Login'
                  ) : (
                    'Register'
                  )}
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
