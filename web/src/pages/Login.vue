<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { login as loginApi } from '@/api/modules/auth'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, Github, Mail, Lock } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { toast } = useToast()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const role = ref<'user' | 'merchant' | 'admin'>('user')
const isLoading = ref(false)
const clearedRef = ref<boolean>(false)

const loginPortal = computed(() => {
  const p = route.meta.loginPortal
  if (p === 'admin' || p === 'merchant' || p === 'user') return p
  return 'user'
})

watch(
  loginPortal,
  (p) => {
    role.value = p
  },
  { immediate: true }
)

const portalHeadline = computed(() => {
  switch (loginPortal.value) {
    case 'admin':
      return 'Administrator sign in'
    case 'merchant':
      return 'Merchant sign in'
    default:
      return 'Welcome back'
  }
})

const portalSubline = computed(() => {
  switch (loginPortal.value) {
    case 'admin':
      return 'Use your admin account to open the control panel.'
    case 'merchant':
      return 'Sign in to manage products, orders, and your storefront.'
    default:
      return 'Enter your credentials to shop and manage your account.'
  }
})

onMounted(() => {
  try {
    if (sessionStorage.getItem('auth_cleared') === '1') {
      clearedRef.value = true
      sessionStorage.removeItem('auth_cleared')
      toast({
        title: 'Session reset',
        description: 'Detected outdated login session and cleared it for safety.',
        variant: 'success'
      })
    }
  } catch {
    /* ignore */
  }
})

const handleLogin = async () => {
  if (!email.value || !password.value) return

  isLoading.value = true
  try {
    const result = await loginApi({
      email: email.value,
      password: password.value,
      role: role.value
    })
    authStore.login(result.user, result.token)

    const roleMap = {
      user: 'User',
      merchant: 'Merchant',
      admin: 'Administrator'
    }

    toast({
      title: `Welcome back, ${roleMap[result.user.role]}!`,
      description: 'You have successfully logged in.',
      variant: 'success'
    })

    const redirect = (route.query.redirect as string)?.trim()
    const target =
      redirect ||
      (result.user.role === 'admin'
        ? '/admin/dashboard'
        : result.user.role === 'merchant'
          ? '/merchant/dashboard'
          : '/')
    router.push(target)
  } catch (e: any) {
    toast({ title: 'Login failed', description: e?.message || 'Unknown error', variant: 'destructive' })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
    <!-- Dynamic Background -->
    <div class="absolute inset-0 z-0">
      <div
        class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"
      ></div>
      <div
        class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[128px] animate-pulse"
      ></div>
      <div
        class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[128px] animate-pulse delay-1000"
      ></div>
    </div>

    <!-- Login Card -->
    <div class="relative z-10 w-full max-w-md p-4 animate-in fade-in zoom-in-95 duration-500">
      <div class="bg-card/30 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 md:p-10">
        <div
          v-if="clearedRef"
          class="mb-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-sm"
        >
          Detected an outdated login session and cleared it. Please sign in again.
        </div>
        <!-- Header -->
        <div class="text-center mb-8">
          <router-link to="/" class="inline-flex items-center gap-2 mb-6 group">
            <div
              class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform"
            >
              N
            </div>
            <span class="text-xl font-bold tracking-tighter">NEXUS</span>
          </router-link>
          <p
            v-if="loginPortal === 'admin'"
            class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-amber-600/90"
          >
            Admin portal
          </p>
          <p
            v-else-if="loginPortal === 'merchant'"
            class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-amber-600/90"
          >
            Merchant portal
          </p>
          <h1 class="text-2xl font-bold tracking-tight mb-2">{{ portalHeadline }}</h1>
          <p class="text-muted-foreground text-sm">{{ portalSubline }}</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Email</label>
            <div class="relative group">
              <Mail
                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                v-model="email"
                type="email"
                placeholder="name@example.com"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between items-center ml-1">
              <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</label>
              <router-link to="/forgot-password" class="text-xs text-primary hover:underline">Forgot?</router-link>
            </div>
            <div class="relative group">
              <Lock
                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                v-model="password"
                type="password"
                placeholder="••••••••"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            class="w-full h-11 text-base mt-6 shadow-lg shadow-primary/25"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Signing in...
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              Sign In <ArrowRight class="w-4 h-4" />
            </span>
          </Button>
        </form>

        <!-- Social / Divider — shopper portal only -->
        <template v-if="loginPortal === 'user'">
          <div class="relative my-8">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t border-border/50"></span>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background/0 backdrop-blur-xl px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <button
              type="button"
              class="flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all text-sm font-medium"
            >
              <Github class="w-4 h-4" /> Github
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-2 h-10 rounded-xl bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border transition-all text-sm font-medium"
            >
              <span class="font-bold">G</span> Google
            </button>
          </div>
        </template>

        <!-- Other portals -->
        <div class="mt-8 space-y-3 text-center text-xs text-muted-foreground">
          <template v-if="loginPortal === 'user'">
            <p>
              Don’t have an account?
              <router-link to="/signup" class="text-primary hover:underline font-medium">Sign up</router-link>
            </p>
          </template>
          <template v-else-if="loginPortal === 'merchant'">
            <p>
              Don't have a store yet?
              <router-link to="/signup?role=merchant" class="text-primary hover:underline font-medium">Open a store</router-link>
            </p>
            <p>
              <router-link to="/login" class="text-primary hover:underline font-medium">Customer sign in</router-link>
              <span class="mx-1.5 text-border">·</span>
              <router-link to="/admin/login" class="text-primary hover:underline font-medium">Admin portal</router-link>
            </p>
            <router-link to="/" class="inline-block hover:text-foreground transition-colors">← Back to store</router-link>
          </template>
          <template v-else>
            <p>
              <router-link to="/login" class="text-primary hover:underline font-medium">Customer sign in</router-link>
              <span class="mx-1.5 text-border">·</span>
              <router-link to="/merchant/login" class="text-primary hover:underline font-medium">Merchant login</router-link>
            </p>
            <router-link to="/" class="inline-block hover:text-foreground transition-colors">← Back to store</router-link>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
