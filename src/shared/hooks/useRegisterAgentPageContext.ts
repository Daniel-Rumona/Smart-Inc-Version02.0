import { useEffect } from 'react'
import { useOptionalAgent } from '@/providers/AgentProvider'
import type { AgentPageContext } from '@/types/agent'

export const useRegisterAgentPageContext = (context: Omit<AgentPageContext, 'updatedAt'>) => {
  const agent = useOptionalAgent()
  const serialized = JSON.stringify(context)

  useEffect(() => {
    if (!agent) return
    const parsed = JSON.parse(serialized) as Omit<AgentPageContext, 'updatedAt'>
    agent.registerPageContext({
      ...parsed,
      updatedAt: new Date().toISOString(),
    })
  }, [agent, serialized])
}
