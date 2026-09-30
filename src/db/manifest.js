import { dataUrl } from '../config.js'

let manifestPromise = null

export function getManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(dataUrl('manifest.json'), { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`manifest.json: HTTP ${r.status} from ${dataUrl('manifest.json')}`)
      return r.json()
    })
  }
  return manifestPromise
}
