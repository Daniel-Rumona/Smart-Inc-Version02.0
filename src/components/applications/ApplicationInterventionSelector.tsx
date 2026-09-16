import { Card, Checkbox, Col, Empty, Row, Space, Tag, Typography } from 'antd'
import { ToolOutlined } from '@ant-design/icons'
import type { ProgramIntervention, ProgramInterventionGroup } from '@/types/application'

type Props = {
  forced: boolean
  forcedInterventions: ProgramIntervention[]
  groups: ProgramInterventionGroup[]
  selections: Record<string, string[]>
  onChange: (value: Record<string, string[]>) => void
}

export default function ApplicationInterventionSelector({ forced, forcedInterventions, groups, selections, onChange }: Props) {
  return (
    <Card
      bordered={false}
      className="program-application-section-card"
      title={<Space><ToolOutlined />Programme interventions</Space>}
    >
      {forced ? (
        forcedInterventions.length ? (
          <Space wrap>
            {forcedInterventions.map((intervention) => (
              <Tag color="blue" key={intervention.id}>{intervention.title}{intervention.area ? ` · ${intervention.area}` : ''}</Tag>
            ))}
          </Space>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No required interventions configured." />
      ) : groups.length ? (
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Typography.Text type="secondary">Choose the interventions that best match the support your business needs.</Typography.Text>
          {groups.map((group) => (
            <Card size="small" key={group.area} title={group.area}>
              <Checkbox.Group
                value={selections[group.area] || []}
                onChange={(ids) => onChange({ ...selections, [group.area]: ids.map(String) })}
                style={{ width: '100%' }}
              >
                <Row gutter={[12, 12]}>
                  {group.interventions.map((intervention) => (
                    <Col xs={24} md={12} key={intervention.id}>
                      <Checkbox value={intervention.id}>{intervention.title}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Card>
          ))}
        </Space>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No selectable interventions configured for this programme." />}
    </Card>
  )
}
