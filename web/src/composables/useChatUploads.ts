import { onBeforeUnmount, ref } from 'vue'
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_IMAGE_ACCEPT,
  validateChatAttachment,
  validateChatImage
} from '@/utils/chatUpload'

export type UploadMessageType = 'text' | 'image' | 'attachment'

export interface UploadMessage {
  id: string
  content: string
  sender: string
  timestamp: Date
  read: boolean
  type?: UploadMessageType
  fileName?: string
  fileUrl?: string
}

export function useChatUploads<TConversation extends { lastMessage: string; lastMessageTime: Date; messages: UploadMessage[] }>(
  options: {
    sender: string
    getActiveConversation: () => TConversation | undefined | null
    toast: (args: { title: string; description?: string; variant?: string }) => void
    scrollToBottom: () => void
  }
) {
  const attachmentInputRef = ref<HTMLInputElement | null>(null)
  const imageInputRef = ref<HTMLInputElement | null>(null)
  const uploadedObjectUrls = ref<string[]>([])

  function pushOutgoingMessage(payload: {
    content: string
    lastMessagePreview?: string
    type?: UploadMessageType
    fileName?: string
    fileUrl?: string
  }) {
    const conv = options.getActiveConversation()
    if (!conv) {
      options.toast({
        title: 'No conversation selected',
        description: 'Please choose a conversation first.',
        variant: 'warning'
      })
      return
    }

    conv.messages.push({
      id: Date.now().toString(),
      content: payload.content,
      sender: options.sender,
      timestamp: new Date(),
      read: false,
      type: payload.type || 'text',
      fileName: payload.fileName,
      fileUrl: payload.fileUrl
    })
    conv.lastMessage = payload.lastMessagePreview || `You: ${payload.content}`
    conv.lastMessageTime = new Date()
    options.scrollToBottom()
  }

  function triggerAttachmentPicker() {
    attachmentInputRef.value?.click()
  }

  function triggerImagePicker() {
    imageInputRef.value?.click()
  }

  function onAttachmentChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const check = validateChatAttachment(file)
    if (!check.ok) {
      options.toast({ title: 'Invalid file type', description: check.message, variant: 'destructive' })
      input.value = ''
      return
    }

    const fileUrl = URL.createObjectURL(file)
    uploadedObjectUrls.value.push(fileUrl)
    pushOutgoingMessage({
      content: `Attachment: ${file.name}`,
      lastMessagePreview: 'You sent an attachment',
      type: 'attachment',
      fileName: file.name,
      fileUrl
    })
    options.toast({ title: 'Attachment added', description: file.name, variant: 'success' })
    input.value = ''
  }

  function onImageChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const check = validateChatImage(file)
    if (!check.ok) {
      options.toast({ title: 'Invalid image', description: check.message, variant: 'destructive' })
      input.value = ''
      return
    }

    const fileUrl = URL.createObjectURL(file)
    uploadedObjectUrls.value.push(fileUrl)
    pushOutgoingMessage({
      content: `Image: ${file.name}`,
      lastMessagePreview: 'You sent an image',
      type: 'image',
      fileName: file.name,
      fileUrl
    })
    options.toast({ title: 'Image added', description: file.name, variant: 'success' })
    input.value = ''
  }

  onBeforeUnmount(() => {
    uploadedObjectUrls.value.forEach((url) => URL.revokeObjectURL(url))
  })

  return {
    // refs
    attachmentInputRef,
    imageInputRef,

    // accept strings
    CHAT_IMAGE_ACCEPT,
    CHAT_ATTACHMENT_ACCEPT,

    // actions
    pushOutgoingMessage,
    triggerAttachmentPicker,
    triggerImagePicker,
    onAttachmentChange,
    onImageChange
  }
}

