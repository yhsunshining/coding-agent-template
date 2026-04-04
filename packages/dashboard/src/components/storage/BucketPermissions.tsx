import { Modal, ModalBody, ModalFooter } from '../ui/Modal'
import { Button } from '../ui'
import { Shield, Lock, Eye, Users, FileEdit } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import type { BucketInfo } from '../../services/storage'
import { capiClient } from '../../services/capi'
import { toast } from 'sonner'
import { envIdAtom } from '../../atoms/env'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  bucket: BucketInfo | null
}

const ACL_OPTIONS = [
  {
    value: 'READONLY',
    label: '所有用户可读，仅创建者和管理员可写',
    icon: Eye,
    desc: '适合公开内容，用户只能管理自己上传的文件',
  },
  {
    value: 'PRIVATE',
    label: '仅创建者及管理员可读写',
    icon: Lock,
    desc: '每个用户只能访问自己的文件',
  },
  {
    value: 'ADMINWRITE',
    label: '所有用户可读，仅管理员可写',
    icon: Users,
    desc: '适合共享资源，由管理员统一管理',
  },
  {
    value: 'ADMINONLY',
    label: '仅管理员可读写',
    icon: Shield,
    desc: '最严格的权限，仅后端/管理员可操作',
  },
]

export default function BucketPermissions({ open, onOpenChange, bucket }: Props) {
  const envId = useAtomValue(envIdAtom)
  const [acl, setAcl] = useState('PRIVATE')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !bucket) return
    setLoading(true)
    capiClient
      .tcb('DescribeStorageACL', { EnvId: envId })
      .then((res: any) => {
        if (res?.AclTag) setAcl(res.AclTag)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, bucket])

  const handleSave = async () => {
    if (!bucket) return
    setSaving(true)
    try {
      await capiClient.tcb('ModifyStorageACL', {
        EnvId: envId,
        AclTag: acl,
      })
      toast.success('权限已更新')
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="云存储权限设置"
      description="选择云开发存储的访问控制策略"
      size="md"
    >
      <ModalBody className="space-y-2">
        {loading ? (
          <p className="text-xs text-fg-muted py-4 text-center">加载当前权限...</p>
        ) : (
          ACL_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  acl === opt.value ? 'border-brand bg-brand/5' : 'border-border-default hover:border-border-strong'
                }`}
              >
                <input
                  type="radio"
                  value={opt.value}
                  checked={acl === opt.value}
                  onChange={() => setAcl(opt.value)}
                  className="mt-1 accent-brand"
                />
                <Icon size={16} className={`mt-0.5 shrink-0 ${acl === opt.value ? 'text-brand' : 'text-fg-lighter'}`} />
                <div>
                  <p className="text-xs font-medium text-fg-default">{opt.label}</p>
                  <p className="text-xs text-fg-lighter mt-0.5">{opt.desc}</p>
                </div>
              </label>
            )
          })
        )}

        <div className="mt-3 p-3 rounded-lg bg-bg-surface-200 border border-border-muted">
          <div className="flex items-center gap-2 mb-1.5">
            <FileEdit size={14} className="text-fg-lighter" />
            <span className="text-xs font-medium text-fg-default">自定义安全规则</span>
          </div>
          <p className="text-xs text-fg-lighter leading-relaxed">
            如需更精细的控制，可在云开发控制台设置自定义安全规则（JSON 格式）。
            支持按用户、路径、文件类型等维度进行读写控制。
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="tiny" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button variant="primary" size="tiny" onClick={handleSave} loading={saving}>
          <Shield size={14} /> 保存权限
        </Button>
      </ModalFooter>
    </Modal>
  )
}
