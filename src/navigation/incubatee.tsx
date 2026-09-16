// src/navigation/incubatee.tsx

import {
    DashboardOutlined,
    BarsOutlined,
    HeatMapOutlined,
} from '@ant-design/icons'

import { Link } from 'react-router-dom'

export const incubateeMenu = [
    {
        key: '/incubatee',
        icon: <DashboardOutlined />,
        label: <Link to="/incubatee">Dashboard</Link>,
    },
    {
        key: '/incubatee/interventions',
        icon: <BarsOutlined />,
        label: <Link to="/incubatee/interventions">Interventions</Link>,
    },
    {
        key: '/incubatee/roadmap',
        icon: <HeatMapOutlined />,
        label: <Link to="/incubatee/roadmap">Roadmap</Link>,
    },
]
