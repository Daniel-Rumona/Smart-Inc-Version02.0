export const agentApiBaseUrl = (import.meta.env.VITE_AGENT_API_BASE_URL || '').replace(/\/$/, '')
export const agentSharedSecret = String(import.meta.env.VITE_AGENT_SHARED_SECRET || '').trim()

export const isAgentApiConfigured = Boolean(agentApiBaseUrl)
