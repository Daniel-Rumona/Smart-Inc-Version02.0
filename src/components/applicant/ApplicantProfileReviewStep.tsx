import { Card, Col, Descriptions, Empty, Row, Statistic, Tag, Typography } from 'antd'
import type { ApplicantProfileFormValues } from '@/pages/applicant/ApplicantProfilePage'

const { Text } = Typography

type ApplicantProfileReviewStepProps = {
  values: ApplicantProfileFormValues
}

function display(value: unknown) {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'object' && 'format' in (value as Record<string, unknown>)) {
    return (value as { format: (format: string) => string }).format('DD MMM YYYY')
  }
  return String(value)
}

function displayLabel(value: unknown) {
  const raw = display(value)
  if (raw === 'â€”') return raw
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function ApplicantProfileReviewStep({ values }: ApplicantProfileReviewStepProps) {
  if (!values || Object.keys(values).length === 0) {
    return <Empty description="No applicant details captured yet" />
  }

  return (
    <div className="applicant-profile-review-step">
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card size="small" className="applicant-profile-review-stat">
            <Statistic title="Applicant" value={display(values.participantName || values.fullName)} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" className="applicant-profile-review-stat">
            <Statistic title="Business" value={display(values.businessName)} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" className="applicant-profile-review-stat">
            <Statistic title="Sector" value={display(values.sector)} />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Review captured information" className="applicant-profile-review-card">
        <Descriptions bordered size="small" column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Full name">{display(values.participantName || values.fullName)}</Descriptions.Item>
          <Descriptions.Item label="Email">{display(values.email)}</Descriptions.Item>
          <Descriptions.Item label="Gender">{displayLabel(values.gender)}</Descriptions.Item>
          <Descriptions.Item label="ID number">{display(values.idNumber)}</Descriptions.Item>
          <Descriptions.Item label="Phone">{display(values.phone)}</Descriptions.Item>
          <Descriptions.Item label="Alternative phone">{display(values.alternativePhone)}</Descriptions.Item>
          <Descriptions.Item label="Marital status">{displayLabel(values.maritalStatus)}</Descriptions.Item>
          <Descriptions.Item label="Employment status">{displayLabel(values.employmentStatus)}</Descriptions.Item>
          <Descriptions.Item label="Education">{displayLabel(values.educationLevel)}</Descriptions.Item>
          <Descriptions.Item label="Disability status">{displayLabel(values.disabilityStatus)}</Descriptions.Item>
          <Descriptions.Item label="Business name">{display(values.businessName)}</Descriptions.Item>
          <Descriptions.Item label="Sector">{display(values.sector)}</Descriptions.Item>
          <Descriptions.Item label="Registration status">
            <Tag>{displayLabel(values.registrationStatus)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Registration number">{display(values.registrationNumber)}</Descriptions.Item>
          <Descriptions.Item label="Date registered">{display(values.dateOfRegistration)}</Descriptions.Item>
          <Descriptions.Item label="Years trading">{display(values.yearsOfTrading)}</Descriptions.Item>
          <Descriptions.Item label="B-BBEE level">{display(values.beeLevel)}</Descriptions.Item>
          <Descriptions.Item label="Youth-owned %">{display(values.youthOwnedPercent)}</Descriptions.Item>
          <Descriptions.Item label="Female-owned %">{display(values.femaleOwnedPercent)}</Descriptions.Item>
          <Descriptions.Item label="Black-owned %">{display(values.blackOwnedPercent)}</Descriptions.Item>
          <Descriptions.Item label="Nature of business" span={2}>
            <Text>{display(values.natureOfBusiness)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Business address" span={2}>{display(values.businessAddress)}</Descriptions.Item>
          <Descriptions.Item label="City / town">{display(values.city)}</Descriptions.Item>
          <Descriptions.Item label="Province">{display(values.province)}</Descriptions.Item>
          <Descriptions.Item label="Postal code">{display(values.postalCode)}</Descriptions.Item>
          <Descriptions.Item label="Host community">{display(values.hostCommunity)}</Descriptions.Item>
          <Descriptions.Item label="Location type">{displayLabel(values.locationType)}</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
