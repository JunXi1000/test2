<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { login as loginApi } from '@/api/modules/auth'
import Button from '@/components/ui/button/Button.vue'
import FormField from '@/components/ui/form/FormField.vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { isValidLoginId } from '@/utils/validators'
import { ArrowRight, Github, Mail, Lock } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { toast } = useToast()
const { t } = useI18n()
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
      return t('auth.adminHeadline')
    case 'merchant':
      return t('auth.merchantHeadline')
    default:
      return t('auth.loginTitle')
  }
})

const portalSubline = computed(() => {
  switch (loginPortal.value) {
    case 'admin':
      return t('auth.adminSubline')
    case 'merchant':
      return t('auth.merchantSubline')
    default:
      return t('auth.userSubline')
  }
})

onMounted(() => {
  try {
    if (sessionStorage.getItem('auth_cleared') === '1') {
      clearedRef.value = true
      sessionStorage.removeItem('auth_cleared')
      toast({
        title: t('auth.sessionReset'),
        description: t('auth.sessionResetDesc'),
        variant: 'success'
      })
    }
  } catch {
    /* ignore */
  }
})

// ── 字段级校验 ─────────────────────────────────────────────────────
const fieldRefs: Record<string, { focus(): void }> = {}
function setFieldRef(name: string) {
  return (el: unknown) => {
    if (el) fieldRefs[name] = el as { focus(): void }
  }
}
function targetValue(e: Event): string {
  return (e.target as HTMLInputElement).value
}

const rules = computed<Rules>(() => ({
  email: (v) => {
    const s = v.trim()
    if (!s) return t('auth.emailRequired')
    return isValidLoginId(s) ? '' : s.includes('@') ? t('auth.emailInvalid') : t('auth.loginIdTooShort')
  },
  password: (v) => (!v ? t('auth.passwordRequired') : '')
}))

const { errors, validateField, onInput, validateAll, isFieldValid } = useFormValidation(
  rules,
  (n) => ({ email: email.value, password: password.value })[n] ?? ''
)

const handleLogin = async () => {
  const invalid = validateAll()
  if (invalid.length) {
    fieldRefs[invalid[0]]?.focus()
    return
  }

  isLoading.value = true
  try {
    const result = await loginApi({
      email: email.value.trim(),
      password: password.value,
      role: role.value
    })
    authStore.login(result.user, result.token)

    const roleMap = {
      user: t('auth.roleUser'),
      merchant: t('auth.roleMerchant'),
      admin: t('auth.roleAdmin')
    }

    toast({
      title: t('auth.welcomeBackRole', { role: roleMap[result.user.role] ?? t('auth.roleUser') }),
      description: t('auth.loginSuccessDesc'),
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
    toast({ title: t('auth.loginFailed'), description: e?.message || t('auth.loginFailedUnknown'), variant: 'destructive' })
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
          {{ $t('auth.clearedBanner') }}
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
            {{ $t('auth.adminPortalBadge') }}
          </p>
          <p
            v-else-if="loginPortal === 'merchant'"
            class="mb-2 text-[11px] font-semibold uppercase tracking-widest text-amber-600/90"
          >
            {{ $t('auth.merchantPortalBadge') }}
          </p>
          <h1 class="text-2xl font-bold tracking-tight mb-2">{{ portalHeadline }}</h1>
          <p class="text-muted-foreground text-sm">{{ portalSubline }}</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleLogin" class="space-y-4" novalidate>
          <FormField
            v-model="email"
            type="email"
            autocomplete="email"
            :label="t('auth.email')"
            :placeholder="t('auth.emailPlaceholder')"
            data-testid="login-username"
            :error="errors.email"
            :valid="isFieldValid('email', email)"
            :ref="setFieldRef('email')"
            @blur="validateField('email', targetValue($event))"
            @input="onInput('email', targetValue($event))"
          >
            <template #icon>
              <Mail class="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            </template>
          </FormField>

          <FormField
            v-model="password"
            type="password"
            autocomplete="current-password"
            :label="t('auth.password')"
            placeholder="••••••••"
            :error="errors.password"
            :valid="isFieldValid('password', password)"
            :ref="setFieldRef('password')"
            @blur="validateField('password', targetValue($event))"
            @input="onInput('password', targetValue($event))"
          >
            <template #label-end>
              <router-link to="/forgot-password" class="text-xs text-primary hover:underline">{{ t('auth.forgotShort') }}</router-link>
            </template>
            <template #icon>
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            </template>
          </FormField>

          <Button
            type="submit"
            class="w-full h-11 text-base mt-6 shadow-lg shadow-primary/25"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="flex items-center gap-2">
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              {{ $t('auth.signingIn') }}
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              {{ $t('auth.signIn') }} <ArrowRight class="w-4 h-4" />
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
              <span class="bg-background/0 backdrop-blur-xl px-2 text-muted-foreground">{{ $t('auth.orContinueWith') }}</span>
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
              {{ $t('auth.noAccount') }}
              <router-link to="/signup" class="text-primary hover:underline font-medium">{{ $t('auth.signUp') }}</router-link>
            </p>
          </template>
          <template v-else-if="loginPortal === 'merchant'">
            <p>
              {{ $t('auth.noStoreYet') }}
              <router-link to="/signup?role=merchant" class="text-primary hover:underline font-medium">{{ $t('auth.openStore') }}</router-link>
            </p>
            <p>
              <router-link to="/login" class="text-primary hover:underline font-medium">{{ $t('auth.customerSignIn') }}</router-link>
              <span class="mx-1.5 text-border">·</span>
              <router-link to="/admin/login" class="text-primary hover:underline font-medium">{{ $t('auth.adminPortalBadge') }}</router-link>
            </p>
            <router-link to="/" class="inline-block hover:text-foreground transition-colors">{{ $t('auth.backToStore') }}</router-link>
          </template>
          <template v-else>
            <p>
              <router-link to="/login" class="text-primary hover:underline font-medium">{{ $t('auth.customerSignIn') }}</router-link>
              <span class="mx-1.5 text-border">·</span>
              <router-link to="/merchant/login" class="text-primary hover:underline font-medium">{{ $t('auth.merchantLogin') }}</router-link>
            </p>
            <router-link to="/" class="inline-block hover:text-foreground transition-colors">{{ $t('auth.backToStore') }}</router-link>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
