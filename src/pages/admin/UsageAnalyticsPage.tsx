import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Card, Col, DatePicker, Empty, Row, Segmented, Select, Space, Tag, Typography } from 'antd'
import {
  BarChartOutlined,
  ClockCircleOutlined,
  LoginOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type Highcharts from 'highcharts'
import dayjs, { type Dayjs } from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import DashboardMetricCard from '@/components/shared/DashboardMetricCard'
import DashboardPage from '@/components/shared/DashboardPage'
import { FilterBar } from '@/components/shared/FilterBar'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { USER_ROLES } from '@/config/roles'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useLanguage } from '@/providers/LanguageProvider'
import {
  listUsagePageViews,
  listUsageSessions,
  type UsagePageViewRecord,
  type UsageSessionRecord,
} from '@/services/usageTrackingService'
import '@/styles/usage-analytics.css'
import { formatUsageRoute } from '@/utils/usageRoutes'
import { ResponsiveDataView } from '@/components/shared/ResponsiveDataView'

const { RangePicker } = DatePicker
dayjs.extend(isBetween)

type UserUsageRow = {
  key: string
  name: string
  email: string
  role: string
  sessions: number
  durationSeconds: number
  lastSeenAt: Date
}

type PageUsageRow = {
  key: string
  path: string
  routeLabel: string
  visits: number
  durationSeconds: number
  users: number
}

const adminRoles = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.ADMIN]

const formatDuration = (seconds: number) => {
  const roundedMinutes = Math.max(0, Math.round(seconds / 60))
  const hours = Math.floor(roundedMinutes / 60)
  const minutes = roundedMinutes % 60

  if (!hours) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export const UsageAnalyticsPage = () => {
  const { user } = useFullIdentity()
  const { t, language } = useLanguage()
  const [sessions, setSessions] = useState<UsageSessionRecord[]>([])
  const [pageViews, setPageViews] = useState<UsagePageViewRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [roleFilter, setRoleFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [routeFilter, setRouteFilter] = useState('all')
  const [section, setSection] = useState('overview')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const canView = !!user && adminRoles.includes(user.role as (typeof adminRoles)[number])

  useEffect(() => {
    if (!canView) {
      return
    }

    Promise.all([listUsageSessions(), listUsagePageViews()])
      .then(([nextSessions, nextPageViews]) => {
        setSessions(nextSessions)
        setPageViews(nextPageViews)
        setError(undefined)
      })
      .catch(() => setError(t('usage.loadError')))
      .finally(() => setLoading(false))
  }, [canView, t])

  const withinDateRange = useCallback((date: Date) => !dateRange || dayjs(date).isBetween(dateRange[0], dateRange[1], 'day', '[]'), [dateRange])
  const filteredSessions = useMemo(() => sessions.filter((session) =>
    (roleFilter === 'all' || session.role === roleFilter)
    && (userFilter === 'all' || session.uid === userFilter)
    && withinDateRange(session.startedAt)), [roleFilter, sessions, userFilter, withinDateRange])
  const filteredPageViews = useMemo(() => pageViews.filter((pageView) =>
    (roleFilter === 'all' || pageView.role === roleFilter)
    && (userFilter === 'all' || pageView.uid === userFilter)
    && (routeFilter === 'all' || pageView.path === routeFilter)
    && withinDateRange(pageView.startedAt)), [pageViews, roleFilter, routeFilter, userFilter, withinDateRange])
  const roleOptions = useMemo(() => [...new Set([...sessions.map((session) => session.role), ...pageViews.map((pageView) => pageView.role)])].filter(Boolean).sort().map((role) => ({ value: role, label: role })), [pageViews, sessions])
  const userOptions = useMemo(() => [...new Map([...sessions, ...pageViews].map((record) => [record.uid, { value: record.uid, label: record.displayName || record.email || t('usage.unknownUser') }])).values()], [pageViews, sessions, t])
  const routeOptions = useMemo(() => [...new Set(pageViews.map((pageView) => pageView.path))].sort().map((path) => ({ value: path, label: formatUsageRoute(path) })), [pageViews])

  const userRows = useMemo<UserUsageRow[]>(() => {
    const totals = new Map<string, UserUsageRow>()

    for (const session of filteredSessions) {
      const current = totals.get(session.uid)

      totals.set(session.uid, {
        key: session.uid,
        name: session.displayName || session.email || t('usage.unknownUser'),
        email: session.email,
        role: session.role,
        sessions: (current?.sessions || 0) + 1,
        durationSeconds: (current?.durationSeconds || 0) + session.durationSeconds,
        lastSeenAt: current && current.lastSeenAt > session.endedAt ? current.lastSeenAt : session.endedAt,
      })
    }

    return [...totals.values()].sort((a, b) => b.durationSeconds - a.durationSeconds)
  }, [filteredSessions, t])

  const pageRows = useMemo<PageUsageRow[]>(() => {
    const totals = new Map<string, { durationSeconds: number; visits: number; users: Set<string> }>()

    for (const pageView of filteredPageViews) {
      const current = totals.get(pageView.path) || { durationSeconds: 0, visits: 0, users: new Set<string>() }
      current.durationSeconds += pageView.durationSeconds
      current.visits += 1
      current.users.add(pageView.uid)
      totals.set(pageView.path, current)
    }

    return [...totals.entries()]
      .map(([path, total]) => ({
        key: path,
        path,
        routeLabel: formatUsageRoute(path),
        visits: total.visits,
        durationSeconds: total.durationSeconds,
        users: total.users.size,
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds)
  }, [filteredPageViews])

  const totalDurationSeconds = filteredSessions.reduce((sum, session) => sum + session.durationSeconds, 0)
  const activeSessions = filteredSessions.filter((session) => session.active).length
  const topPage = pageRows[0]?.routeLabel || t('usage.noData')
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(language === 'zu' ? 'zu-ZA' : 'en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    [language],
  )

  const pagesChartOptions = useMemo<Highcharts.Options>(() => ({
    chart: { type: 'bar', height: 330 },
    title: { text: undefined },
    xAxis: { categories: pageRows.slice(0, 8).map((row) => row.routeLabel) },
    yAxis: { min: 0, title: { text: t('usage.minutes') } },
    series: [{
      type: 'bar',
      name: t('usage.timeUsed'),
      data: pageRows.slice(0, 8).map((row) => Math.round(row.durationSeconds / 60)),
    }],
  }), [pageRows, t])

  const usersChartOptions = useMemo<Highcharts.Options>(() => ({
    chart: { type: 'column', height: 330 },
    title: { text: undefined },
    xAxis: { categories: userRows.slice(0, 8).map((row) => row.name) },
    yAxis: { min: 0, title: { text: t('usage.minutes') } },
    series: [{
      type: 'column',
      name: t('usage.loggedInTime'),
      data: userRows.slice(0, 8).map((row) => Math.round(row.durationSeconds / 60)),
    }],
  }), [t, userRows])
  const trendChartOptions = useMemo<Highcharts.Options>(() => {
    const days = new Map<string, { visits: number, durationSeconds: number }>()
    filteredPageViews.forEach((pageView) => {
      const key = dayjs(pageView.startedAt).format('YYYY-MM-DD')
      const current = days.get(key) || { visits: 0, durationSeconds: 0 }
      current.visits += 1
      current.durationSeconds += pageView.durationSeconds
      days.set(key, current)
    })
    const entries = [...days.entries()].sort(([left], [right]) => left.localeCompare(right))
    return {
      chart: { type: 'spline', height: 320 },
      title: { text: undefined },
      xAxis: { categories: entries.map(([date]) => dayjs(date).format('DD MMM')) },
      yAxis: [{ min: 0, title: { text: t('usage.visits') } }, { min: 0, opposite: true, title: { text: t('usage.minutes') } }],
      series: [
        { type: 'spline', name: t('usage.visits'), data: entries.map(([, total]) => total.visits) },
        { type: 'spline', name: t('usage.minutes'), yAxis: 1, data: entries.map(([, total]) => Math.round(total.durationSeconds / 60)) },
      ],
    }
  }, [filteredPageViews, t])

  if (!canView) {
    return (
      <DashboardPage>
        <Alert type="error" showIcon message={t('usage.forbidden')} />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage className="usage-analytics-page">
      {error && <Alert type="error" showIcon message={error} className="usage-analytics-alert" />}
      <Row gutter={[14, 14]} className="usage-analytics-metrics">
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<ClockCircleOutlined />} label={t('usage.totalTime')} value={formatDuration(totalDurationSeconds)} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<LoginOutlined />} label={t('usage.sessions')} value={filteredSessions.length} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<TeamOutlined />} label={t('usage.activeNow')} value={activeSessions} /></Col>
        <Col xs={12} lg={6}><DashboardMetricCard loading={loading} icon={<BarChartOutlined />} label={t('usage.mostUsed')} value={topPage} /></Col>
      </Row>
      <FilterBar title={t('usage.filters')} primary={<><Select value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: t('usage.allRoles') }, ...roleOptions]} /><Select value={userFilter} onChange={setUserFilter} options={[{ value: 'all', label: t('usage.allUsers') }, ...userOptions]} /><Select value={routeFilter} onChange={setRouteFilter} options={[{ value: 'all', label: t('usage.allRoutes') }, ...routeOptions]} /><RangePicker value={dateRange} onChange={(value) => setDateRange(value as [Dayjs, Dayjs] | null)} /></>} />
      <Segmented className="usage-analytics-segments" block value={section} onChange={setSection} options={[
        { value: 'overview', label: t('usage.overview') },
        { value: 'users', label: t('usage.users') },
        { value: 'pages', label: t('usage.pages') },
      ]} />

      {section === 'overview' && <Card title={t('usage.activityTrend')} bordered={false} className="usage-analytics-table-card">
          {filteredPageViews.length ? <ThemedHighcharts options={trendChartOptions} /> : <Empty />}
        </Card>}

      {section === 'users' && <>
        <Card title={t('usage.usersChart')} bordered={false} className="usage-analytics-table-card">
          {userRows.length ? <ThemedHighcharts options={usersChartOptions} /> : <Empty />}
        </Card>
        <Card title={t('usage.usersTable')} bordered={false} className="usage-analytics-table-card">
          <ResponsiveDataView
            rowKey="key"
            rows={userRows}
            emptyText={t('usage.noData')}
            columns={[
              { title: t('usage.user'), dataIndex: 'name', key: 'name', render: (_, row) => <Space direction="vertical" size={0}><Typography.Text strong>{row.name}</Typography.Text><Typography.Text type="secondary">{row.email}</Typography.Text></Space> },
              { title: t('usage.role'), dataIndex: 'role', key: 'role', render: (role) => <Tag color="purple">{role}</Tag> },
              { title: t('usage.sessions'), dataIndex: 'sessions', key: 'sessions' },
              { title: t('usage.loggedInTime'), dataIndex: 'durationSeconds', key: 'durationSeconds', render: formatDuration },
              { title: t('usage.lastSeen'), dataIndex: 'lastSeenAt', key: 'lastSeenAt', render: (date) => dateFormatter.format(date) },
            ]}
            renderCard={(row) => <Space orientation="vertical"><Typography.Text strong>{row.name}</Typography.Text><Typography.Text type="secondary">{row.email}</Typography.Text><Tag color="purple">{row.role}</Tag><Typography.Text>{t('usage.loggedInTime')}: {formatDuration(row.durationSeconds)}</Typography.Text></Space>}
          />
        </Card>
      </>}

      {section === 'pages' && <>
        <Card title={t('usage.pagesChart')} bordered={false} className="usage-analytics-table-card">
          {pageRows.length ? <ThemedHighcharts options={pagesChartOptions} /> : <Empty />}
        </Card>
        <Card title={t('usage.pagesTable')} bordered={false} className="usage-analytics-table-card">
          <ResponsiveDataView
            rowKey="key"
            rows={pageRows}
            emptyText={t('usage.noData')}
            columns={[
              { title: t('usage.page'), dataIndex: 'routeLabel', key: 'routeLabel', render: (_, row) => <Space orientation="vertical" size={0}><Typography.Text strong>{row.routeLabel}</Typography.Text><Typography.Text type="secondary">{row.path}</Typography.Text></Space> },
              { title: t('usage.visits'), dataIndex: 'visits', key: 'visits' },
              { title: t('usage.uniqueUsers'), dataIndex: 'users', key: 'users' },
              { title: t('usage.timeUsed'), dataIndex: 'durationSeconds', key: 'durationSeconds', render: formatDuration },
            ]}
            renderCard={(row) => <Space orientation="vertical"><Typography.Text strong>{row.routeLabel}</Typography.Text><Typography.Text type="secondary">{row.path}</Typography.Text><Typography.Text>{t('usage.visits')}: {row.visits}</Typography.Text><Typography.Text>{t('usage.timeUsed')}: {formatDuration(row.durationSeconds)}</Typography.Text></Space>}
          />
        </Card>
      </>}
    </DashboardPage>
  )
}
