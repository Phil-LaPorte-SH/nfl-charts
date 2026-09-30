// Turn a dropped / pasted / picked file into a Claude image block.
// Claude reads images best at <= 1568 px on the long edge and ~1.15 MP; larger
// images are downscaled server-side anyway, so shrinking here saves upload
// time and tokens without losing legibility.
const MAX_EDGE = 1568
const MAX_PIXELS = 1_150_000
const MAX_BYTES = 3_500_000 // API limit is 5 MB of base64 per image
export const MAX_IMAGES = 4
const SUPPORTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

const blobToDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result)
  r.onerror = rej
  r.readAsDataURL(blob)
})

export function isImageFile(f) {
  return f && (f.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|heif|bmp|avif)$/i.test(f.name || ''))
}

export async function fileToImage(file) {
  let bmp
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error(`${file.name || 'Image'}: this browser can't read that format. Try PNG or JPEG.`)
  }
  const { width: w0, height: h0 } = bmp
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0), Math.sqrt(MAX_PIXELS / (w0 * h0)))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  let blob = file
  let mediaType = file.type
  if (scale < 1 || !SUPPORTED.includes(file.type) || file.size > MAX_BYTES) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff' // flatten transparency for JPEG
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    // PNG keeps chart text crisp; fall back to JPEG if it's too big.
    blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
    mediaType = 'image/png'
    if (!blob || blob.size > MAX_BYTES) {
      blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
      mediaType = 'image/jpeg'
    }
  }
  bmp.close?.()
  const dataUrl = await blobToDataUrl(blob)
  return {
    id: crypto.randomUUID(),
    name: file.name || 'pasted image',
    mediaType,
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    dataUrl,
    width: w,
    height: h,
  }
}

/** Claude content blocks for a list of processed images. */
export const imageBlocks = (images) => (images || []).map((im) => ({
  type: 'image',
  source: { type: 'base64', media_type: im.mediaType, data: im.base64 },
}))
