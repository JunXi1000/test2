/** Map an in-app path to the correct sign-in URL (user / admin / merchant). */
export function loginPathFromAppPath(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin/login'
  if (pathname.startsWith('/merchant')) return '/merchant/login'
  return '/login'
}

export type LoginRouteName = 'Login' | 'AdminLogin' | 'MerchantLogin'

export function loginRouteNameFromAppPath(pathname: string): LoginRouteName {
  if (pathname.startsWith('/admin')) return 'AdminLogin'
  if (pathname.startsWith('/merchant')) return 'MerchantLogin'
  return 'Login'
}
