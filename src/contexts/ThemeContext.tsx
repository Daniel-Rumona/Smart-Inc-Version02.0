import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import { darkTheme, lightTheme } from '@/config/theme'

type ThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    document.body.dataset.theme = mode
  }, [mode])

  const value = useMemo<ThemeContextValue>(() => {
    return {
      mode,
      setMode,
      toggleTheme: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }
  }, [mode])

  const config = mode === 'light' ? lightTheme : darkTheme

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        pagination={{ showSizeChanger: false }}
        theme={{
          ...config,
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeMode = () => {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useThemeMode must be used inside ThemeProvider')
  }

  return context
}
