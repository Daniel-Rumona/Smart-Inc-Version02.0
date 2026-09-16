import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/providers/LanguageProvider'

export const NotFoundPage = () => {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <main className="public-result-page">
      <Result
        status="404"
        title="404"
        subTitle={t('notFound.subtitle')}
        extra={<Button type="primary" onClick={() => navigate('/')}>{t('common.backHome')}</Button>}
      />
    </main>
  )
}
