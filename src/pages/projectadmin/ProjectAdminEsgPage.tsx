import { Button, Card, Col, List, Progress, Row, Segmented, Space, Statistic, Tag, Typography } from 'antd'
import { BankOutlined, CheckCircleOutlined, CloudOutlined, SafetyCertificateOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons'
import type Highcharts from 'highcharts'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardHeader from '@/components/shared/DashboardHeader'
import DashboardPage from '@/components/shared/DashboardPage'
import { ThemedHighcharts } from '@/components/shared/ThemedHighcharts'
import { CHART_COLORS } from '@/config/chartPalette'

const { Paragraph, Text, Title } = Typography
type EsgView = 'overview' | 'e' | 's' | 'g'

const scoreCards = [
    { key: 'E', title: 'Environmental', score: 78, color: CHART_COLORS.success, icon: <CloudOutlined />, summary: 'Strong energy and waste practices, with room to improve emissions evidence.' },
    { key: 'S', title: 'Social', score: 71, color: CHART_COLORS.primary, icon: <TeamOutlined />, summary: 'Good reach across SMEs and jobs supported; beneficiary feedback needs more coverage.' },
    { key: 'G', title: 'Governance', score: 74, color: CHART_COLORS.violet, icon: <BankOutlined />, summary: 'Policies and oversight are established; reporting consistency is the next priority.' },
]

const scoreChart: Highcharts.Options = {
    chart: { type: 'column', height: 300 }, title: { text: undefined }, xAxis: { categories: ['E · Environmental', 'S · Social', 'G · Governance'] }, yAxis: { min: 0, max: 100, title: { text: 'Score' } }, legend: { enabled: false }, tooltip: { pointFormat: '<b>{point.y}/100</b>' }, plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}' } } },
    series: [{ type: 'column', name: 'ESG score', data: [{ y: 78, color: CHART_COLORS.success }, { y: 71, color: CHART_COLORS.primary }, { y: 74, color: CHART_COLORS.violet }] }],
}

const trendChart: Highcharts.Options = {
    chart: { type: 'spline', height: 300 }, title: { text: undefined }, xAxis: { categories: ['Q1', 'Q2', 'Q3', 'Q4'] }, yAxis: { min: 50, max: 100, title: { text: 'Score' } }, tooltip: { shared: true },
    series: [{ type: 'spline', name: 'Environmental', color: CHART_COLORS.success, data: [68, 72, 75, 78] }, { type: 'spline', name: 'Social', color: CHART_COLORS.primary, data: [62, 66, 69, 71] }, { type: 'spline', name: 'Governance', color: CHART_COLORS.violet, data: [64, 67, 70, 74] }],
}

const initiativesChart: Highcharts.Options = {
    chart: { type: 'bar', height: 340 }, title: { text: undefined }, xAxis: { categories: ['Energy baseline', 'SME jobs supported', 'Beneficiary feedback', 'Policy coverage', 'Audit evidence'] }, yAxis: { min: 0, max: 100, title: { text: 'Completion (%)' } }, legend: { enabled: false }, plotOptions: { series: { dataLabels: { enabled: true, format: '{point.y}%' } } },
    series: [{ type: 'bar', name: 'Initiative completion', color: CHART_COLORS.cyan, data: [82, 76, 58, 88, 64] }],
}

const insightItems = [
    { icon: <CheckCircleOutlined />, color: 'green', title: 'Environmental momentum', text: 'Energy and waste evidence improved across the last two reporting periods.' },
    { icon: <WarningOutlined />, color: 'orange', title: 'Social evidence gap', text: 'Beneficiary feedback coverage is 58%; add post-intervention surveys to strengthen the score.' },
    { icon: <SafetyCertificateOutlined />, color: 'blue', title: 'Governance opportunity', text: 'Policy coverage is strong, but audit evidence should be attached consistently to each programme.' },
]

export default function ProjectAdminEsgPage() {
    const navigate = useNavigate()
    const [view, setView] = useState<EsgView>('overview')
    const selectedPillar = scoreCards.find((pillar) => pillar.key.toLowerCase() === view)

    return (
        <DashboardPage className="project-admin-esg-page">
            <DashboardHeader title="ESG scorecard" subtitle="A granular view of environmental, social, and governance performance across the programme portfolio." actions={<Button type="primary" onClick={() => navigate('/projectadmin/esg/performance')}>Individual performance</Button>} />
            <Row gutter={[16, 16]}>
                <Col xs={24} md={12} xl={6}><Card className="dashboard-section-card"><Statistic title="Overall ESG score" value={74} suffix="/100" valueStyle={{ color: CHART_COLORS.violet }} /><Progress percent={74} strokeColor={CHART_COLORS.violet} showInfo={false} /></Card></Col>
                <Col xs={24} md={12} xl={6}><Card className="dashboard-section-card"><Statistic title="Evidence coverage" value={68} suffix="%" valueStyle={{ color: CHART_COLORS.primary }} /><Progress percent={68} strokeColor={CHART_COLORS.primary} showInfo={false} /></Card></Col>
                <Col xs={24} md={12} xl={6}><Card className="dashboard-section-card"><Statistic title="Active initiatives" value={18} valueStyle={{ color: CHART_COLORS.success }} /><Text type="secondary">Across 6 programme areas</Text></Card></Col>
                <Col xs={24} md={12} xl={6}><Card className="dashboard-section-card"><Statistic title="Priority actions" value={5} valueStyle={{ color: CHART_COLORS.amber }} /><Text type="secondary">Need evidence or follow-up</Text></Card></Col>
            </Row>
            <Card className="dashboard-section-card" style={{ marginTop: 16 }}>
                <Segmented block value={view} onChange={(value) => setView(value as EsgView)} options={[{ label: 'ESG overview', value: 'overview' }, { label: 'E · Environmental', value: 'e' }, { label: 'S · Social', value: 's' }, { label: 'G · Governance', value: 'g' }]} style={{ marginBottom: 24 }} />
                {view === 'overview' && <Row gutter={[16, 16]}><Col xs={24} lg={12}><Title level={5}>Current pillar scores</Title><ThemedHighcharts options={scoreChart} /></Col><Col xs={24} lg={12}><Title level={5}>Score trend</Title><ThemedHighcharts options={trendChart} /></Col></Row>}
                {selectedPillar && <PillarDetail pillar={selectedPillar} />}
            </Card>
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={14}><Card className="dashboard-section-card" title="Initiative completion by theme"><ThemedHighcharts options={initiativesChart} /></Card></Col>
                <Col xs={24} lg={10}><Card className="dashboard-section-card" title="Key insights"><List dataSource={insightItems} renderItem={(item) => <List.Item><List.Item.Meta avatar={<Tag color={item.color} icon={item.icon} />} title={item.title} description={item.text} /></List.Item>} /></Card></Col>
            </Row>
        </DashboardPage>
    )
}

function PillarDetail({ pillar }: { pillar: typeof scoreCards[number] }) {
    return <Row gutter={[16, 16]} align="middle"><Col xs={24} md={8}><Progress type="circle" percent={pillar.score} strokeColor={pillar.color} format={(value) => <><strong>{value}</strong><small>/100</small></>} /></Col><Col xs={24} md={16}><Space direction="vertical" size={8}><Title level={4}>{pillar.icon} {pillar.key} · {pillar.title}</Title><Paragraph>{pillar.summary}</Paragraph><Space wrap><Tag color="green">2 strengths</Tag><Tag color="orange">1 priority</Tag><Tag>Evidence tracked</Tag></Space></Space></Col></Row>
}
