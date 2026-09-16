import { getAuth } from 'firebase/auth'

export const getAgentAuthHeaders = async (): Promise<Record<string, string>> => {
  const currentUser = getAuth().currentUser

  if (!currentUser) {
    throw new Error('You must be signed in to use this agent.')
  }

  return {
    Authorization: `Bearer ${await currentUser.getIdToken()}`,
  }
}
