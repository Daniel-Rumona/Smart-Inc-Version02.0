import { Button, Grid, Modal, Typography } from 'antd'
import { SlidersOutlined } from '@ant-design/icons'
import { useState, type ReactNode } from 'react'
import { MotionCard, SunkenPanel } from '@/components/shared/MotionCard'
import { useLanguage } from '@/providers/LanguageProvider'

type FilterBarProps = {
  title?: ReactNode
  primary: ReactNode
  advanced?: ReactNode
  actions?: ReactNode
  /**
   * Skip the mobile "Filters" button and modal, and render `primary` (plus
   * `actions`) inline instead. The modal exists to tuck away more filters
   * than a phone screen can show at once — a page with only a control or two
   * and no `advanced` section has nothing worth hiding behind it.
   */
  compact?: boolean
}

export const FilterBar = ({ title, primary, advanced, actions, compact = false }: FilterBarProps) => {
  const { t } = useLanguage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const inline = compact && !advanced

  return (
    <>
      <MotionCard className="filter-bar">
        <SunkenPanel className="filter-bar-panel">
          {title && <Typography.Title level={5} className="filter-bar-title">{title}</Typography.Title>}
          {isMobile && !inline
            ? <Button block icon={<SlidersOutlined />} onClick={() => setAdvancedOpen(true)}>{t('common.filters')}</Button>
            : (
              <div className={`filter-bar-primary${isMobile ? ' is-stacked' : ''}`}>
                <div className="filter-bar-controls">
                  {primary}
                  {actions}
                  {advanced && <Button icon={<SlidersOutlined />} onClick={() => setAdvancedOpen(true)}>{t('common.moreFilters')}</Button>}
                </div>
              </div>
            )}
        </SunkenPanel>
      </MotionCard>

      {!inline && (
        <Modal
          open={advancedOpen}
          title={t('common.filters')}
          onCancel={() => setAdvancedOpen(false)}
          footer={<Button type="primary" onClick={() => setAdvancedOpen(false)}>{t('common.applyFilters')}</Button>}
          centered
          className="filter-modal"
        >
          <div className="filter-modal-grid">
            {isMobile && primary}
            {advanced}
          </div>
        </Modal>
      )}
    </>
  )
}
