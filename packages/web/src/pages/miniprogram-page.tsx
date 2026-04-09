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
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'

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

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">小程序管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理微信小程序的 AppId 和部署私钥</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          添加
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">加载中...</div>
      ) : apps.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <p>暂无小程序配置。</p>
          <Button variant="outline" className="mt-4" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            添加第一个小程序
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>AppId</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">{app.name}</TableCell>
                  <TableCell className="font-mono text-sm">{app.appId}</TableCell>
                  <TableCell className="text-muted-foreground">{app.description || '-'}</TableCell>
                  <TableCell>{formatDate(app.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditDialog(app)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(app)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingApp ? '编辑小程序' : '添加小程序'}</DialogTitle>
            <DialogDescription>
              {editingApp ? '更新小程序配置信息。' : '填写微信小程序 AppId 及部署私钥。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            <div className="space-y-2">
              <Label htmlFor="mp-name">名称 *</Label>
              <Input
                id="mp-name"
                placeholder="我的小程序"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-appid">AppId *（格式：wx...）</Label>
              <Input
                id="mp-appid"
                placeholder="wx1234567890abcdef"
                className="font-mono"
                value={formAppId}
                onChange={(e) => setFormAppId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-key">私钥 {editingApp ? '（留空则保持不变）' : '*'}</Label>
              <Textarea
                id="mp-key"
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
                className="font-mono text-xs min-h-[100px]"
                value={formPrivateKey}
                onChange={(e) => setFormPrivateKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mp-desc">描述</Label>
              <Input
                id="mp-desc"
                placeholder="可选备注"
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
              确定要删除 <strong>{deleteTarget?.name}</strong>（{deleteTarget?.appId}）吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
