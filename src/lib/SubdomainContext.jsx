import { createContext, useContext } from 'react'

export const SubdomainContext = createContext(null)

export function useSubdomainOrg() {
  return useContext(SubdomainContext)
}
