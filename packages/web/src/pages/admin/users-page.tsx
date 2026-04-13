import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../../components/ui/dialog'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { toast } from 'sonner'
import { UserPlus, ShieldCheck, ShieldOff, Ban, Check, LayoutDashboard, Trash2 } from 'lucide-react'

interface User {
  id: string
  username: string
  email: string | null
  role: 'user' | 'admin'
  status: 'active' | 'disabled'
  provider: string
  createdAt: number
  lastLoginAt: number
  disabledReason?: string | null
  disabledAt?: number | null
  envId: string | null
  envStatus: string | null
  credentialType: 'permanent' | 'temp' | null
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTimeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return formatDate(ts)
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Dialogs
  const [disableDialogOpen, setDisableDialogOpen] = useState(false)
  const [enableDialogOpen, setEnableDialogOpen] = useState(false)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [disableReason, setDisableReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Create user form
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')

  useEffect(() => {
    loadUsers()
  }, [page])

  async function loadUsers() {
    setLoading(true)
    try {
      const data = (await api.get(`/api/admin/users?page=${page}&limit=20`)) as {
        users: User[]
        pagination: { totalPages: number }
      }
      setUsers(data.users)
      setTotalPages(data.pagination.totalPages)
    } catch {
      toast.error('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisableUser() {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      await api.post(`/api/admin/users/${selectedUser.id}/disable`, { reason: disableReason })
      toast.success('用户已禁用')
      setDisableDialogOpen(false)
      setSelectedUser(null)
      setDisableReason('')
      loadUsers()
    } catch {
      toast.error('禁用用户失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEnableUser() {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      await api.post(`/api/admin/users/${selectedUser.id}/enable`)
      toast.success('用户已启用')
      setEnableDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch {
      toast.error('启用用户失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSetRole(role: 'user' | 'admin') {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      await api.post(`/api/admin/users/${selectedUser.id}/set-role`, { role })
      toast.success('角色已更新')
      setRoleDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch {
      toast.error('更新角色失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return
    setIsSubmitting(true)
    try {
      await api.delete(`/api/admin/users/${selectedUser.id}`)
      toast.success('User deleted')
      setDeleteDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    } catch {
      toast.error('Failed to delete user')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreateUser() {
    if (!newUsername || !newPassword) {
      toast.error('请填写用户名和密码')
      return
    }
    if (newPassword.length < 6) {
      toast.error('密码至少需要 6 个字符')
      return
    }
    setIsSubmitting(true)
    try {
      await api.post('/api/admin/users/create', {
        username: newUsername,
        password: newPassword,
        email: newEmail || undefined,
        role: newRole,
      })
      toast.success('用户创建成功')
      setCreateDialogOpen(false)
      setNewUsername('')
      setNewPassword('')
      setNewEmail('')
      setNewRole('user')
      loadUsers()
    } catch {
      toast.error('创建用户失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">用户管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理系统用户和权限</p>
        </div>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          创建用户
        </Button>
      </div>

      {/* User Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">加载中...</div>
      ) : users.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">暂无用户</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">用户名</TableHead>
                <TableHead className="w-[70px]">角色</TableHead>
                <TableHead className="w-[70px]">状态</TableHead>
                <TableHead className="w-[160px]">环境 ID</TableHead>
                <TableHead className="w-[90px]">凭证类型</TableHead>
                <TableHead className="w-[80px]">来源</TableHead>
                <TableHead className="w-[110px]">注册时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className={user.status === 'disabled' ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{user.username}</div>
                      {user.email && <div className="text-xs text-muted-foreground truncate">{user.email}</div>}
                      {user.disabledReason && (
                        <div className="text-xs text-red-500 truncate">原因: {user.disabledReason}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-[11px]">
                      {user.role === 'admin' ? '管理员' : '用户'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.status === 'active' ? (
                      <Badge variant="outline" className="text-[11px] text-green-600 border-green-200">
                        正常
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[11px]">
                        已禁用
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.envId ? (
                      <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate block max-w-[150px]">
                        {user.envId}
                      </code>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.credentialType === 'permanent' ? (
                      <Badge variant="outline" className="text-[11px] text-green-600 border-green-200">
                        永久密钥
                      </Badge>
                    ) : user.credentialType === 'temp' ? (
                      <Badge variant="secondary" className="text-[11px]">
                        临时密钥
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.provider === 'local' ? '本地' : 'GitHub'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {user.envId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => navigate(`/admin/dashboard/${user.id}`)}
                        >
                          <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                          Dashboard
                        </Button>
                      )}
                      {user.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSelectedUser(user)
                            setDisableDialogOpen(true)
                          }}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          禁用
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-green-600"
                          onClick={() => {
                            setSelectedUser(user)
                            setEnableDialogOpen(true)
                          }}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          启用
                        </Button>
                      )}
                      {user.role === 'user' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => {
                            setSelectedUser(user)
                            setRoleDialogOpen(true)
                          }}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          设为管理员
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => {
                            setSelectedUser(user)
                            setRoleDialogOpen(true)
                          }}
                        >
                          <ShieldOff className="h-3.5 w-3.5 mr-1" />
                          取消管理员
                        </Button>
                      )}
                      {user.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSelectedUser(user)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <span className="py-1.5 px-3 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* Disable Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>禁用用户</DialogTitle>
            <DialogDescription>禁用后，用户 "{selectedUser?.username}" 将无法登录系统。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">禁用原因</Label>
              <Input
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                placeholder="请输入禁用原因（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDisableDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisableUser} disabled={isSubmitting}>
              {isSubmitting ? '处理中...' : '确认禁用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable Dialog */}
      <Dialog open={enableDialogOpen} onOpenChange={setEnableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>启用用户</DialogTitle>
            <DialogDescription>
              确定要启用用户 "{selectedUser?.username}" 吗？启用后该用户可以正常登录。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEnableDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleEnableUser} disabled={isSubmitting}>
              {isSubmitting ? '处理中...' : '确认启用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedUser?.role === 'user' ? '设置管理员' : '取消管理员'}</DialogTitle>
            <DialogDescription>
              {selectedUser?.role === 'user'
                ? `确定要将用户 "${selectedUser?.username}" 设置为管理员吗？管理员可以访问管理后台。`
                : `确定要取消用户 "${selectedUser?.username}" 的管理员权限吗？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRoleDialogOpen(false)}>
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => handleSetRole(selectedUser?.role === 'user' ? 'admin' : 'user')}
              disabled={isSubmitting}
            >
              {isSubmitting ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建新用户</DialogTitle>
            <DialogDescription>创建一个本地账户，用户可以使用用户名和密码登录。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">用户名 *</Label>
                <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="username" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">密码 *</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">邮箱</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">角色</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as 'user' | 'admin')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">普通用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting ? '创建中...' : '创建用户'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除用户</DialogTitle>
            <DialogDescription>
              确定要永久删除用户 &quot;{selectedUser?.username}&quot;
              吗？该操作不可撤销，用户的所有数据（任务、连接器、定时任务等）将被一并删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteUser} disabled={isSubmitting}>
              {isSubmitting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
