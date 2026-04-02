/** Allowed chat uploads: image vs document-style attachments */

const IMAGE_MIMES = new RegExp(
  '^image/(jpeg|png|gif|webp|bmp|svg\\+xml|x-icon|vnd\\.microsoft\\.icon|avif|heic|heif)(;.*)?$',
  'i'
)

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'heic', 'heif'])

/** Office / PDF / text / archive — extensions used when MIME is missing or generic */
const ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/rtf'
])

const ATTACHMENT_EXT = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
  'rar',
  '7z',
  'rtf'
])

function extLower(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export const CHAT_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml,image/x-icon,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg,.ico,.avif,.heic,.heif'

export const CHAT_ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function validateChatImage(file: File): { ok: true } | { ok: false; message: string } {
  const ext = extLower(file.name)
  const type = (file.type || '').trim().toLowerCase()
  if (type && IMAGE_MIMES.test(type)) return { ok: true }
  if (type === 'application/octet-stream' && ext && IMAGE_EXT.has(ext)) return { ok: true }
  if (ext && IMAGE_EXT.has(ext)) return { ok: true }
  return {
    ok: false,
    message: `Invalid image format. Allowed: JPEG, PNG, GIF, WebP, BMP, SVG, ICO, AVIF, HEIC/HEIF (got "${type || ext || 'unknown'}").`
  }
}

export function validateChatAttachment(file: File): { ok: true } | { ok: false; message: string } {
  const ext = extLower(file.name)
  const type = (file.type || '').trim().toLowerCase()

  if (type && ATTACHMENT_MIMES.has(type)) return { ok: true }
  if (type === 'application/octet-stream' && ext && ATTACHMENT_EXT.has(ext)) return { ok: true }
  if (type.startsWith('text/') && (ext === 'txt' || ext === 'csv' || !ext)) return { ok: true }
  if (ext && ATTACHMENT_EXT.has(ext)) return { ok: true }

  return {
    ok: false,
    message:
      'Invalid attachment type. Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP, RAR, 7Z, RTF.'
  }
}
