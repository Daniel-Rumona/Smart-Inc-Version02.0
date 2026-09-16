import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { App as AntdApp } from 'antd'
import { ThemeProvider } from './ThemeProvider'
import { LanguageProvider } from './LanguageProvider'
import { AgentProvider } from './AgentProvider'
import { IdentityProvider } from '@/contexts/IdentityProvider'
import { AssignedInterventionsProvider } from '@/contexts/AssignedInterventionsContext'
import { SystemSettingsProvider } from '@/contexts/SystemSettingsContext'
import { UsageTrackingProvider } from './UsageTrackingProvider'
import { BackgroundTasksProvider } from './BackgroundTasksProvider'
import { AppUpdateModal } from '@/components/shared/AppUpdateModal'

export const AppProviders: React.FC<React.PropsWithChildren> = ({ children }) => {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <LanguageProvider>
                    <AgentProvider>
                        <IdentityProvider>
                            <SystemSettingsProvider>
                                <AssignedInterventionsProvider>
                                    <BackgroundTasksProvider>
                                        <UsageTrackingProvider>
                                            <AntdApp>
                                                {children}
                                                <AppUpdateModal />
                                            </AntdApp>
                                        </UsageTrackingProvider>
                                    </BackgroundTasksProvider>
                                </AssignedInterventionsProvider>
                            </SystemSettingsProvider>
                        </IdentityProvider>
                    </AgentProvider>
                </LanguageProvider>
            </ThemeProvider>
        </BrowserRouter>
    )
}
