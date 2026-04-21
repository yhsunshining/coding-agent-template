import { atom } from 'jotai'

export interface SessionUser {
  id: string
  username: string
  name?: string
  email?: string
  avatar?: string
  role: 'user' | 'admin'
}

export interface SessionUserInfo {
  user?: SessionUser
  authProvider?: 'github' | 'local' | 'cloudbase'
  envId?: string
  provisionStatus?: 'processing' | 'success' | 'failed' | 'not_started'
}

export const sessionAtom = atom<SessionUserInfo>({ user: undefined })
export const sessionLoadedAtom = atom(false)
