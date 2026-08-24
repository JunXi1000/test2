<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, Mail } from 'lucide-vue-next'
import { requestPasswordReset } from '@/api/modules/auth'

const router = useRouter()
const { toast } = useToast()
const { t } = useI18n()

const email = ref('')
const isLoading = ref(false)
const isSent = ref(false)
const resetCode = ref('')

const handleReset = async () => {
  if (!email.value) return

  isLoading.value = true
  try {
    resetCode.value = await requestPasswordReset(email.value.trim())
    isSent.value = true
    toast({
      title: t('auth.codeSent'),
      description: t('auth.codeSentDesc'),
      variant: 'success'
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('auth.resetFailedDesc')
    toast({ title: t('auth.resetFailed'), description: msg, variant: 'destructive' })
  } finally {
    isLoading.value = false
  }
}

const goReset = () => {
  router.push({ name: 'ResetPassword', query: { token: resetCode.value, email: email.value.trim() } })
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
    <!-- Dynamic Background -->
    <div class="absolute inset-0 z-0">
      <div
        class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"
      />
    </div>

    <!-- Card -->
    <div class="relative z-10 w-full max-w-md p-4 animate-in fade-in zoom-in-95 duration-500">
      <div class="bg-card/30 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 md:p-10">
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
          <h1 class="text-2xl font-bold tracking-tight mb-2">{{ $t('auth.forgotTitle') }}</h1>
          <p class="text-muted-foreground text-sm">
            {{ isSent ? $t('auth.forgotSent') : $t('auth.forgotSubtitle') }}
          </p>
        </div>

        <div v-if="isSent" class="text-center space-y-6">
          <div class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-sm border border-emerald-500/20 text-left space-y-2">
            <p v-html="$t('auth.forgotSentTo', { email })"></p>
            <p class="text-2xl font-mono font-bold tracking-[0.3em] text-center py-2 text-foreground">{{ resetCode }}</p>
            <p class="text-xs text-muted-foreground border-t border-emerald-500/20 pt-2 mt-2">
              {{ $t('auth.forgotCodeHint') }}
            </p>
          </div>
          <Button class="w-full" @click="goReset">{{ $t('auth.continueReset') }}</Button>
          <Button variant="ghost" class="w-full" @click="router.push('/login')">{{ $t('auth.backToLogin') }}</Button>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleReset" class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">{{ $t('auth.email') }}</label>
            <div class="relative group">
              <Mail class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="email"
                type="email"
                placeholder="name@example.com"
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
              {{ $t('common.loading') }}
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              {{ $t('auth.sendResetLink') }} <ArrowRight class="w-4 h-4" />
            </span>
          </Button>
        </form>

        <!-- Footer -->
        <div v-if="!isSent" class="text-center mt-8 text-sm text-muted-foreground">
          {{ $t('auth.rememberPassword') }}
          <router-link to="/login" class="text-primary hover:underline font-medium">{{ $t('auth.goLogin') }}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
