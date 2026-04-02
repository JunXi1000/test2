export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface PageResult<T> {
  list: T[]
  pagination: Pagination
}
