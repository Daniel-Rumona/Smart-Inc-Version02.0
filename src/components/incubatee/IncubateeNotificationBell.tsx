import { Badge, Button, Empty, List, Modal, Typography } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useLanguage } from '@/providers/LanguageProvider'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { loadIncubateeWorkspace, markIncubateeNotification } from '@/services/incubateeWorkspaceService'
import type { IncubateeNotification } from '@/types/incubatee'

import '@/styles/notifications.css'

dayjs.extend(relativeTime)

// Notification types arrive as snake_case keys, so they need a readable form in the list.
const describeType = (type?: string) => {
  if (!type) return ''
  const label = type.replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const receivedAt = (value: IncubateeNotification['createdAt']) => {
  if (!value) return null
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return dayjs(value.toDate())
  const parsed = dayjs(value as string | number | Date)
  return parsed.isValid() ? parsed : null
}

export const IncubateeNotificationBell = () => {
  const { t } = useLanguage()
  const { user } = useFullIdentity()
  const [notifications, setNotifications] = useState<IncubateeNotification[]>([])
  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)

  const load = async () => {
    if (!user) return
    const workspace = await loadIncubateeWorkspace(user)
    setNotifications(workspace?.notifications || [])
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = async (item: IncubateeNotification) => {
    if (item.read) return
    await markIncubateeNotification(item.id, true)
    await load()
  }

  const markAllRead = async () => {
    const unreadItems = notifications.filter((item) => !item.read)
    if (!unreadItems.length) return
    setMarking(true)
    try {
      await Promise.all(unreadItems.map((item) => markIncubateeNotification(item.id, true)))
      await load()
    } finally {
      setMarking(false)
    }
  }

  const unread = notifications.filter((item) => !item.read).length

  // Unread first, newest first inside each group, so what needs attention is never below the fold.
  const ordered = useMemo(() => [...notifications].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1
    return (receivedAt(b.createdAt)?.valueOf() || 0) - (receivedAt(a.createdAt)?.valueOf() || 0)
  }), [notifications])

  return (
    <>
      <Button
        type="text"
        shape="circle"
        icon={<Badge count={unread} size="small"><BellOutlined /></Badge>}
        onClick={() => setOpen(true)}
        className="app-icon-btn"
        aria-label={t('incubatee.notifications.title')}
      />
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={t('incubatee.notifications.title')}
        footer={null}
        className="notifications-modal"
      >
        <div className="notifications-summary">
          <Typography.Text type="secondary">
            {unread
              ? t('incubatee.notifications.unreadCount', '{count} unread').replace('{count}', String(unread))
              : t('incubatee.notifications.allRead', 'You are all caught up')}
          </Typography.Text>

          {unread > 0 && (
            <Button
              type="link"
              size="small"
              loading={marking}
              onClick={() => void markAllRead()}
            >
              {t('incubatee.notifications.markAllRead', 'Mark all as read')}
            </Button>
          )}
        </div>

        <List
          className="notifications-list"
          dataSource={ordered}
          locale={{ emptyText: <Empty description={t('incubatee.notifications.empty')} /> }}
          renderItem={(item) => {
            const stamp = receivedAt(item.createdAt)
            return (
              <List.Item
                className={`notification-item ${item.read ? 'is-read' : 'is-unread'}`}
                title={item.read ? undefined : t('incubatee.notifications.markRead')}
                onClick={() => void markRead(item)}
              >
                <span className="notification-state" aria-hidden="true" />

                <List.Item.Meta
                  title={item.title}
                  description={[describeType(item.type), stamp?.fromNow()].filter(Boolean).join(' · ')}
                />

                {!item.read && <span className="notification-state-label">{t('incubatee.notifications.unread', 'Unread')}</span>}
              </List.Item>
            )
          }}
        />
      </Modal>
    </>
  )
}

export default IncubateeNotificationBell
