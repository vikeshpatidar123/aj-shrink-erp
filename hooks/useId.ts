import { useEffect, useState } from 'react'

let idCounter = 0

export function useClientId(prefix: string = 'id'): string {
  const [id, setId] = useState(`${prefix}-ssr`)

  useEffect(() => {
    setId(`${prefix}-${++idCounter}`)
  }, [prefix])

  return id
}

export function useUniqueId(prefix: string = 'id'): string {
  const [id, setId] = useState(`${prefix}-ssr`)

  useEffect(() => {
    setId(`${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }, [prefix])

  return id
}