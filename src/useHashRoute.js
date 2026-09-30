import { useEffect, useState } from 'react'

export function useHashRoute() {
  const get = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(get)
  useEffect(() => {
    const on = () => setRoute(get())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
