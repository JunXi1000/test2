<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, KeyRound, Lock, Mail } from 'lucide-vue-next'
import { resetPasswordWithToken } from '@/api/modules/auth'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()
const { t } = useI18n()

// 邮件链接带入 token(验证码)与 email
const rawToken = route.query.token
const token = typeof rawToken === 'string' ? rawToken : Array.isArray(rawToken) && typeof rawToken[0] === 'string' ? rawToken[0] : ''
const rawEmail = route.query.email
const initialEmail = typeof rawEmail === 'string' ? rawEmail : ''

const email = ref(initialEmail)
const code = ref(token)
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const done = ref(false)

const canSubmit = computed(() => email.value.trim().length > 0 && code.value.trim().length > 0)

async function handleSubmit() {
  if (!canSubmit.value) return
  if (password.value.length < 8) {
    toast({
      title: t('auth.passwordTooShort'),
      description: t('auth.passwordTooShortDesc'),
      variant: 'destructive'
    })
    return
  }
  if (password.value !== confirmPassword.value) {
    toast({
      title: t('auth.passwordMismatch'),
      description: t('auth.passwordMismatchDesc'),
      variant: 'destructive'
    })
    return
  }

  isLoading.value = true
  try {
    await resetPasswordWithToken(code.value, email.value, password.value)
    done.value = true
    toast({
      title: t('auth.passwordUpdated'),
      description: t('auth.passwordUpdatedDesc'),
      variant: 'success'
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('auth.resetFailedDesc')
    toast({ title: t('auth.resetFailed'), description: msg, variant: 'destructive' })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
    <div class="absolute inset-0 z-0">
      <div
        class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"
      />
    </div>

    <div class="relative z-10 w-full max-w-md p-4 animate-in fade-in zoom-in-95 duration-500">
      <div class="bg-card/30 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 md:p-10">
        <div class="text-center mb-8">
          <router-link to="/" class="inline-flex items-center gap-2 mb-6 group">
            <div
              class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform"
            >
              N
            </div>
            <span class="text-xl font-bold tracking-tighter">NEXUS</span>
          </router-link>

          <template v-if="!canSubmit">
            <h1 class="text-2xl font-bold tracking-tight mb-2">{{ $t('auth.resetInvalidTitle') }}</h1>
            <p class="text-muted-foreground text-sm">{{ $t('auth.resetInvalidDesc') }}</p>
            <div class="mt-6 space-y-3">
              <Button class="w-full" @click="router.push({ name: 'ForgotPassword' })">{{ $t('auth.resendCode') }}</Button>
              <Button variant="outline" class="w-full" @click="router.push({ name: 'Login' })">{{ $t('auth.backToLogin') }}</Button>
            </div>
          </template>

          <template v-else-if="done">
            <h1 class="text-2xl font-bold tracking-tight mb-2">{{ $t('auth.passwordUpdated') }}</h1>
            <p class="text-muted-foreground text-sm">{{ $t('auth.passwordUpdatedDesc') }}</p>
            <Button class="w-full mt-6" @click="router.push({ name: 'Login' })">{{ $t('auth.goToLogin') }}</Button>
          </template>

          <template v-else>
            <h1 class="text-2xl font-bold tracking-tight mb-2">{{ $t('auth.resetTitle') }}</h1>
            <p class="text-muted-foreground text-sm">{{ $t('auth.resetSubtitle') }}</p>
          </template>
        </div>

        <form v-if="canSubmit && !done" @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">{{ $t('auth.email') }}</label>
            <div class="relative group">
              <Mail class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="email"
                type="email"
                :placeholder="$t('auth.emailPlaceholder')"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">{{ $t('auth.resetCode') }}</label>
            <div class="relative group">
              <KeyRound class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="code"
                type="text"
                :placeholder="$t('auth.resetCodePlaceholder')"
                maxlength="6"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">{{ $t('auth.newPassword') }}</label>
            <div class="relative group">
              <Lock
                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                :placeholder="$t('auth.newPasswordPlaceholder')"
                minlength="8"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">{{ $t('auth.confirmPassword') }}</label>
            <div class="relative group">
              <Lock
                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                :placeholder="$t('auth.confirmPasswordPlaceholder')"
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
              <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {{ $t('auth.submitting') }}
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              {{ $t('auth.resetSubmit') }} <ArrowRight class="w-4 h-4" />
            </span>
          </Button>
        </form>

        <div v-if="canSubmit && !done" class="text-center mt-8 text-sm text-muted-foreground">
          <router-link to="/login" class="text-primary hover:underline font-medium">{{ $t('auth.backToLogin') }}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
