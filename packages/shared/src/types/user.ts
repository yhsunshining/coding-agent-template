import { z } from 'zod'

// ─── Users ───────────────────────────────────────────────────────────────────

export const insertUserSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(['github', 'local']),
  externalId: z.string().min(1),
  accessToken: z.string().default(''),
  refreshToken: z.string().optional(),
  scope: z.string().optional(),
  username: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  lastLoginAt: z.number().optional(),
})

export const selectUserSchema = z.object({
  id: z.string(),
  provider: z.enum(['github', 'local']),
  externalId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  scope: z.string().nullable(),
  username: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastLoginAt: z.number(),
})

export type User = z.infer<typeof selectUserSchema>
export type InsertUser = z.infer<typeof insertUserSchema>

// ─── Session Types ────────────────────────────────────────────────────────────

export interface SessionUserInfo {
  user: SessionUser | undefined
  authProvider?: 'github'
}

export interface Tokens {
  accessToken: string
  expiresAt?: number
  refreshToken?: string
}

export interface Session {
  created: number
  authProvider: 'github'
  user: SessionUser
}

export interface SessionUser {
  id: string
  username: string
  email: string | undefined
  avatar: string
  name?: string
}
