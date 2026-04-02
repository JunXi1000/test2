import { get, put, del } from '@/api/http'
import { RUNTIME_USE_MOCK } from '@/config/env'

export type AdminReviewStatus = 'visible' | 'hidden'

export interface AdminReview {
  id: string
  productId: number
  productTitle: string
  userName: string
  userEmail?: string
  rating: number
  content: string
  createdAt: string
  status: AdminReviewStatus
  images?: string[]
  verifiedPurchase?: boolean
}

const STORAGE_KEY = 'mock_admin_reviews'

const DEFAULT_MOCK_REVIEWS: AdminReview[] = [
  {
    id: 'rev-001',
    productId: 1,
    productTitle: 'Nexus VR Pro',
    userName: 'Alex Chen',
    userEmail: 'alex@example.com',
    rating: 5,
    content:
      'Absolutely amazing quality. The build is solid and it feels premium in hand. Exceeded all my expectations.',
    createdAt: '2026-03-25T14:20:00Z',
    status: 'visible',
    verifiedPurchase: true
  },
  {
    id: 'rev-002',
    productId: 1,
    productTitle: 'Nexus VR Pro',
    userName: 'Sarah Miller',
    userEmail: 'sarah@example.com',
    rating: 4,
    content: 'Great product overall, though shipping took a day longer than expected.',
    createdAt: '2026-03-20T09:15:00Z',
    status: 'visible',
    verifiedPurchase: true
  },
  {
    id: 'rev-003',
    productId: 2,
    productTitle: 'Smart Ring',
    userName: 'Jordan Wang',
    rating: 5,
    content: 'Best purchase this year. Highly recommend.',
    createdAt: '2026-03-18T11:00:00Z',
    status: 'visible',
    images: ['https://images.unsplash.com/photo-1623998021446-45cd9b269056?q=80&w=400&auto=format&fit=crop']
  },
  {
    id: 'rev-004',
    productId: 3,
    productTitle: 'Audio Pods X',
    userName: 'Spam Bot',
    userEmail: 'spam@bad.example',
    rating: 1,
    content: 'CLICK HERE FOR FREE PRIZES!!! http://evil.example',
    createdAt: '2026-03-17T08:00:00Z',
    status: 'hidden'
  },
  {
    id: 'rev-005',
    productId: 5,
    productTitle: 'Minimal Desk',
    userName: 'Lisa Park',
    rating: 2,
    content: 'Not what I expected from the photos. Minor scratch on arrival.',
    createdAt: '2026-03-10T16:45:00Z',
    status: 'visible',
    verifiedPurchase: true
  },
  {
    id: 'rev-006',
    productId: 1,
    productTitle: 'Nexus VR Pro',
    userName: 'David Kim',
    rating: 4,
    content: 'Solid build. Manual was hard to follow.',
    createdAt: '2026-03-01T12:30:00Z',
    status: 'visible'
  },
  {
    id: 'rev-007',
    productId: 4,
    productTitle: 'Cyber Watch',
    userName: 'Rachel Torres',
    rating: 1,
    content: 'Stopped working after two weeks. Very disappointing.',
    createdAt: '2026-02-20T10:00:00Z',
    status: 'visible',
    verifiedPurchase: true
  },
  {
    id: 'rev-008',
    productId: 2,
    productTitle: 'Smart Ring',
    userName: 'Mike Ross',
    rating: 5,
    content: 'Perfect fit and great battery life.',
    createdAt: '2026-02-15T19:22:00Z',
    status: 'visible'
  }
]

function getMockData(): AdminReview[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as AdminReview[]
  } catch {
    /* ignore */
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_REVIEWS))
  return DEFAULT_MOCK_REVIEWS
}

function saveMockData(list: AdminReview[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export interface AdminReviewQuery {
  q?: string
  status?: string
}

export async function getAdminReviews(params?: AdminReviewQuery): Promise<AdminReview[]> {
  if (RUNTIME_USE_MOCK.value) {
    let data = [...getMockData()]
    if (params?.status && params.status !== 'all') {
      data = data.filter((r) => r.status === params.status)
    }
    if (params?.q?.trim()) {
      const q = params.q.trim().toLowerCase()
      data = data.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.userName.toLowerCase().includes(q) ||
          (r.userEmail && r.userEmail.toLowerCase().includes(q)) ||
          r.productTitle.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q) ||
          String(r.productId).includes(q)
      )
    }
    data.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return new Promise((resolve) => setTimeout(() => resolve(data), 400))
  }
  return get<AdminReview[]>('/admin/reviews', { params })
}

export async function updateAdminReviewStatus(id: string, status: AdminReviewStatus): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData()
    const row = list.find((r) => r.id === id)
    if (!row) throw new Error('Review not found')
    row.status = status
    saveMockData(list)
    return new Promise((resolve) => setTimeout(resolve, 300))
  }
  await put(`/admin/reviews/${id}`, { status })
}

export async function deleteAdminReview(id: string): Promise<void> {
  if (RUNTIME_USE_MOCK.value) {
    const list = getMockData().filter((r) => r.id !== id)
    saveMockData(list)
    return new Promise((resolve) => setTimeout(resolve, 300))
  }
  await del(`/admin/reviews/${id}`)
}
