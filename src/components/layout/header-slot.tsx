import { createContext, useContext } from 'react'

export const HeaderSlotContext = createContext<HTMLDivElement | null>(null)

export function useHeaderSlot() {
  return useContext(HeaderSlotContext)
}
