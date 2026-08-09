import { post } from '@/api/http'

export interface UploadResult {
  url: string
  name: string
}

/**
 * Upload a file to the backend (POST /file/upload).
 * Returns the accessible URL (e.g. http://localhost:1000/file/<md5>.<ext>).
 * Note: this has no mock branch — callers fall back to local preview when mock is on.
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  return post<UploadResult>('/file/upload', form)
}
