export type Participant = {
  id: string
  uid?: string
  name?: string
  displayName?: string
  businessName?: string
  email?: string
  gender?: string
  sector?: string
  beeLevel?: string
  ownership?: string
  [key: string]: unknown
}
