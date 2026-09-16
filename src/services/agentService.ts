import { agentApiBaseUrl, isAgentApiConfigured } from '@/config/agent'
import { getAuth } from 'firebase/auth'
import type { AgentChatMessage, AgentPageContext } from '@/types/agent'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/config/firebase'
import type { FullIdentity } from '@/types/identity'

type SendAgentMessageOptions = {
  message: string
  page: AgentPageContext
  history: AgentChatMessage[]
}

type AgentResponse = {
  reply: string
  actionKey?: string | null
}

export const sendAgentMessage = async ({
  message,
  page,
  history,
}: SendAgentMessageOptions): Promise<AgentResponse> => {
  if (!isAgentApiConfigured) {
    throw new Error('The workspace assistant endpoint is not configured.')
  }

  const currentUser = getAuth().currentUser
  if (!currentUser) {
    throw new Error('You must be signed in to use the workspace assistant.')
  }

  const response = await fetch(`${agentApiBaseUrl}/api/agent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      page,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body?.detail
    const backendMessage = typeof detail === 'string'
      ? detail
      : detail?.message || body?.error || ''
    const normalized = backendMessage.toLowerCase()

    if (
      response.status === 429 ||
      normalized.includes('quota') ||
      normalized.includes('resource_exhausted') ||
      normalized.includes('usage limit')
    ) {
      throw new Error('The assistant has reached its usage limit for now. Please try again later or contact your programme administrator.')
    }

    throw new Error(
      backendMessage || 'The workspace assistant could not respond. Please try again.',
    )
  }

  return response.json() as Promise<AgentResponse>
}

export const submitAgentConversationRating = async (input: {
  user: FullIdentity
  conversationId: string
  messageId: string
  page: AgentPageContext
  rating: number
}) => {
  await addDoc(collection(getFirebaseDb(), 'agentConversationRatings'), {
    conversationId: input.conversationId,
    messageId: input.messageId,
    rating: input.rating,
    pageKey: input.page.pageKey,
    pageName: input.page.pageName,
    userUid: input.user.uid,
    companyCode: input.user.companyCode || null,
    agentId: 'workspace-assistant',
    agentName: 'Workspace Assistant',
    agentType: 'system',
    channel: 'web',
    createdAt: serverTimestamp(),
  })
}
