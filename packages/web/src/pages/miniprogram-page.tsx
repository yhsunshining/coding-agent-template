import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Smartphone } from 'lucide-react'
import { SharedHeader } from '../components/shared-header'

interface MiniProgramApp {
  id: string
  name: string
  appId: string
  privateKey: string
  description: string | null
  createdAt: number
  updatedAt: number
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function MiniProgramPage() {
  const [apps, setApps] = useState<MiniProgramApp[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingApp, setEditingApp] = useState<MiniProgramApp | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MiniProgramApp | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formAppId, setFormAppId] = useState('')
  const [formPrivateKey, setFormPrivateKey] = useState('')
  const [formDescription, setFormDescription] = useState('')

  const loadApps = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: MiniProgramApp[] }>('/api/miniprogram')
      setApps(res.data)
    } catch {
      toast.error('加载小程序失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  function openAddDialog() {
    setEditingApp(null)
    setFormName('')
    setFormAppId('')
    setFormPrivateKey('')
    setFormDescription('')
    setDialogOpen(true)
  }

  function openEditDialog(app: MiniProgramApp) {
    setEditingApp(app)
    setFormName(app.name)
    setFormAppId(app.appId)
    setFormPrivateKey('')
    setFormDescription(app.description || '')
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formAppId.trim()) {
      toast.error('名称和 AppId 不能为空')
      return
    }
    if (!editingApp && !formPrivateKey.trim()) {
      toast.error('私钥不能为空')
      return
    }

    setSaving(true)
    try {
      if (editingApp) {
        const body: Record<string, string> = {
          name: formName.trim(),
          appId: formAppId.trim(),
          description: formDescription.trim(),
        }
        if (formPrivateKey.trim()) {
          body.privateKey = formPrivateKey.trim()
        }
        await api.patch(`/api/miniprogram/${editingApp.id}`, body)
        toast.success('已更新')
      } else {
        await api.post('/api/miniprogram', {
          name: formName.trim(),
          appId: formAppId.trim(),
          privateKey: formPrivateKey.trim(),
          description: formDescription.trim() || undefined,
        })
        toast.success('已添加')
      }
      setDialogOpen(false)
      await loadApps()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/miniprogram/${deleteTarget.id}`)
      toast.success('已删除')
      setDeleteTarget(null)
      await loadApps()
    } catch (err: any) {
      toast.error(err.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const headerLeft = (
    <div className="flex items-center gap-2 min-w-0">
      <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <h1 className="text-base font-semibold truncate">小程序管理</h1>
    </div>
  )

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b">
        <SharedHeader leftActions={headerLeft} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Page title + action */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">小程序凭证</h2>
            <p className="text-sm text-muted-foreground mt-1">
              管理微信小程序的 AppId 与部署私钥，用于 CI/CD 自动发布。
            </p>
          </div>
          <Button onClick={openAddDialog} className="flex-shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            添加小程序
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">加载中...</div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <Smartphone className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="font-medium">暂无小程序配置</p>
              <p className="text-sm mt-1">添加一个微信小程序以开始使用部署功能</p>
            </div>
            <Button variant="outline" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              添加第一个小程序
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[180px]">名称</TableHead>
                  <TableHead className="w-[220px]">AppId</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="w-[120px]">私钥</TableHead>
                  <TableHead className="w-[120px]">创建时间</TableHead>
                  <TableHead className="w-[80px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{app.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{app.appId}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{app.description || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-normal">
                        已配置
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(app)}
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteTarget(app)}
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingApp ? '编辑小程序' : '添加小程序'}</DialogTitle>
            <DialogDescription>
              {editingApp ? '更新小程序配置信息。' : '填写微信小程序 AppId 及部署私钥。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="mp-name">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mp-name"
                placeholder="我的小程序"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-appid">
                AppId <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mp-appid"
                placeholder="wx1234567890abcdef"
                className="font-mono"
                value={formAppId}
                onChange={(e) => setFormAppId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">格式：wx 开头的 18 位字符串</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-key">
                私钥{' '}
                {editingApp ? (
                  <span className="text-muted-foreground font-normal">（留空则保持不变）</span>
                ) : (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              <Textarea
                id="mp-key"
                placeholder={'-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                className="font-mono text-xs min-h-[120px] resize-none"
                value={formPrivateKey}
                onChange={(e) => setFormPrivateKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">在微信公众平台 → 开发设置 → 小程序代码上传密钥中获取</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-desc">描述</Label>
              <Input
                id="mp-desc"
                placeholder="可选备注，便于识别用途"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : editingApp ? '更新' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除小程序</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 <strong>{deleteTarget?.name}</strong>（
              <code className="text-xs">{deleteTarget?.appId}</code>）吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
