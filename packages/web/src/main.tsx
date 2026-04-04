import { StrictMode, useEffect, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router'
import { Provider as JotaiProvider, useAtom, useAtomValue } from 'jotai'
import { AppLayout } from './components/app-layout'
import { HomePage } from './pages/HomePage'
import { TaskPage } from './pages/TaskPage'
import { TasksListPage } from './pages/TasksListPage'
import { LoginPage } from './pages/LoginPage'
import { sessionAtom, sessionLoadedAtom } from './lib/atoms/session'
import { api } from './lib/api'
import { Loader2 } from 'lucide-react'
import { ThemeProvider } from './components/theme-provider'
import './index.css'

// Error boundary to catch runtime errors
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen items-center justify-center bg-background p-8">
          <div className="text-center max-w-lg">
            <h1 className="text-xl font-bold text-red-600 mb-4">Runtime Error</h1>
            <pre className="text-sm text-left bg-red-50 p-4 rounded overflow-auto max-h-64">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Auth provider that checks session on startup
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setSession] = useAtom(sessionAtom)
  const [, setLoaded] = useAtom(sessionLoadedAtom)

  useEffect(() => {
    console.log('[AuthProvider] Checking session...')
    api
      .get<{ user: { id: string; username: string; name?: string; email?: string; avatar?: string }; envId?: string }>(
        '/api/auth/me',
      )
      .then((data) => {
        console.log('[AuthProvider] Session data:', data)
        setSession({ user: data.user, envId: data.envId })
        setLoaded(true)
      })
      .catch((err) => {
        console.log('[AuthProvider] No session:', err)
        setSession({ user: undefined })
        setLoaded(true)
      })
  }, [setSession, setLoaded])

  const loaded = useAtomValue(sessionLoadedAtom)
  console.log('[AuthProvider] loaded:', loaded)

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}

// Login route that redirects if already authenticated
function LoginRoute() {
  const session = useAtomValue(sessionAtom)
  const loaded = useAtomValue(sessionLoadedAtom)
  const navigate = useNavigate()

  useEffect(() => {
    if (loaded && session.user) {
      navigate('/', { replace: true })
    }
  }, [loaded, session, navigate])

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (session.user) {
    return null
  }

  return <LoginPage />
}

// Protect routes that require authentication
function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useAtomValue(sessionAtom)
  const loaded = useAtomValue(sessionLoadedAtom)
  const navigate = useNavigate()

  useEffect(() => {
    if (loaded && !session.user) {
      navigate('/login', { replace: true })
    }
  }, [loaded, session, navigate])

  if (!loaded || !session.user) return null
  return <>{children}</>
}

function App() {
  console.log('[App] Rendering...')
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/tasks"
            element={
              <RequireAuth>
                <AppLayout>
                  <TasksListPage />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <AppLayout>
                <HomePage />
              </AppLayout>
            }
          />
          <Route
            path="/tasks/:taskId"
            element={
              <RequireAuth>
                <AppLayout>
                  <TaskPage />
                </AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <JotaiProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </JotaiProvider>
  </StrictMode>,
)
