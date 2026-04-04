import { atom } from 'jotai'

export interface SessionUser {
  id: string
  username: string
  name?: string
  email?: string
  avatar?: string
}

export interface SessionUserInfo {
  user?: SessionUser
  authProvider?: 'github' | 'vercel' | 'local'
  envId?: string
}

export const sessionAtom = atom<SessionUserInfo>({ user: undefined })
export const sessionLoadedAtom = atom(false)
