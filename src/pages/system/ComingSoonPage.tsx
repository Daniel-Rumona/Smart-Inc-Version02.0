import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/providers/LanguageProvider'

export const ComingSoonPage = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <Result
      status="info"
      title={t('placeholder.title')}
      subTitle={t('placeholder.subtitle')}
      extra={<Button type="primary" onClick={() => navigate('/dashboard')}>{t('common.dashboard')}</Button>}
    />
  )
}
