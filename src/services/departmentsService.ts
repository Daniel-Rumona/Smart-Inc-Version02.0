import { listCollection } from '@/services/firestoreList'

export type Department = {
  id: string
  name?: string
  departmentName?: string
}

export const listDepartments = () => listCollection<Department>('departments')
