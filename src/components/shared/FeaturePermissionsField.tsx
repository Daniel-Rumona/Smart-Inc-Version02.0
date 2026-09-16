import { Checkbox, Space, Typography } from 'antd'
import { FEATURE_PERMISSION_OPTIONS } from '@/config/permissions'
import type { IdentityPermission } from '@/types/identity'
import { useLanguage } from '@/providers/LanguageProvider'

type FeaturePermissionsFieldProps = {
  value?: IdentityPermission[]
  onChange?: (permissions: IdentityPermission[]) => void
}

const featurePermissions = FEATURE_PERMISSION_OPTIONS.map((option) => option.value)

export const FeaturePermissionsField = ({ value = [], onChange }: FeaturePermissionsFieldProps) => {
  const { t } = useLanguage()
  const selected = value.filter((permission) => featurePermissions.includes(permission))
  const baseline = value.filter((permission) => !featurePermissions.includes(permission))
  const fullAccess = featurePermissions.every((permission) => selected.includes(permission))

  return (
    <Space orientation="vertical" size={10} style={{ width: '100%' }}>
      <Checkbox
        checked={fullAccess}
        onChange={(event) => onChange?.([...baseline, ...(event.target.checked ? featurePermissions : [])])}
      >
        <Typography.Text strong>{t('permissions.fullAccess')}</Typography.Text>
      </Checkbox>
      <Checkbox.Group
        className="feature-permissions-grid"
        value={selected}
        options={FEATURE_PERMISSION_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
        onChange={(permissions) => onChange?.([...baseline, ...(permissions as IdentityPermission[])])}
      />
    </Space>
  )
}
