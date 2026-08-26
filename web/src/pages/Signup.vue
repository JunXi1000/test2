<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { register as registerApi } from '@/api/modules/auth'
import Button from '@/components/ui/button/Button.vue'
import FormField from '@/components/ui/form/FormField.vue'
import { useFormValidation, type Rules } from '@/composables/useFormValidation'
import { isValidEmail } from '@/utils/validators'
import { ArrowRight, Mail, Lock, User, Store, ShieldAlert } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { toast } = useToast()
const { t } = useI18n()

// ── Role ─────────────────────────────────────────────────────────────
const role = ref<'user' | 'merchant'>('user')

onMounted(() => {
  // Pre-select role from query param (e.g. /signup?role=merchant)
  const qRole = (route.query.role as string)?.toLowerCase()
  if (qRole === 'merchant') role.value = 'merchant'
})

// ── Shared fields ────────────────────────────────────────────────────
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

// ── Merchant-only fields ─────────────────────────────────────────────
const storeName = ref('')

const isLoading = ref(false)
const errorMessage = ref('')

const isMerchant = computed(() => role.value === 'merchant')

function switchRole(r: 'user' | 'merchant') {
  role.value = r
  errorMessage.value = ''
  reset()
}

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

const termsAccepted = ref(false)

// key 顺序与 DOM 顺序一致:storeName(仅商家)→ name → email → password → confirmPassword → terms
const rules = computed<Rules>(() => {
  const r: Rules = {}
  if (isMerchant.value) {
    r.storeName = (v) =>
      !v.trim() ? t('auth.storeNameRequired') : v.trim().length < 2 ? t('auth.storeNameTooShort') : ''
  }
  r.name = (v) => (!v.trim() ? t('auth.nameRequired') : v.trim().length < 2 ? t('auth.nameTooShort') : '')
  r.email = (v) => (!v.trim() ? t('auth.emailRequired') : isValidEmail(v) ? '' : t('auth.emailInvalid'))
  r.password = (v) => (!v ? t('auth.passwordRequired') : v.length < 6 ? t('auth.passwordMinLength') : '')
  r.confirmPassword = (v) =>
    !v ? t('auth.confirmPasswordRequired') : v !== password.value ? t('auth.passwordsNotMatch') : ''
  r.terms = () => (termsAccepted.value ? '' : t('auth.termsRequired'))
  return r
})

const { errors, validateField, onInput, validateAll, isFieldValid, reset } = useFormValidation(
  rules,
  (n) =>
    ({
      storeName: storeName.value,
      name: name.value,
      email: email.value,
      password: password.value,
      confirmPassword: confirmPassword.value,
      terms: String(termsAccepted.value)
    })[n] ?? ''
)

const handleSignup = async () => {
  errorMessage.value = ''

  const invalid = validateAll()
  if (invalid.length) {
    fieldRefs[invalid[0]]?.focus()
    return
  }

  isLoading.value = true

  try {
    // email 同时作为后端 username 存储,必须 trim —— 否则首尾空格与登录(登录前会 trim)不一致导致登录不上
    await registerApi({
      role: role.value,
      email: email.value.trim(),
      password: password.value,
      nickname: name.value.trim(),
      storeName: isMerchant.value ? storeName.value.trim() : undefined
    })

    const notice = isMerchant.value ? t('auth.storePendingNotice') : t('auth.accountReadyNotice')

    toast({
      title: isMerchant.value ? t('auth.storeSubmitted') : t('auth.accountCreated'),
      description: notice,
      variant: 'success'
    })

    // Redirect to login
    const loginPath = isMerchant.value ? '/merchant/login' : '/login'
    router.push(loginPath)
  } catch (err: any) {
    const msg = err?.message || t('auth.registrationFailedDesc')
    errorMessage.value = msg
    toast({
      title: t('auth.registrationFailed'),
      description: msg,
      variant: 'destructive'
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
    <!-- Dynamic Background -->
    <div class="absolute inset-0 z-0">
      <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-primary/20 via-background to-background"></div>
      <div class="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[128px] animate-pulse"></div>
      <div class="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[128px] animate-pulse delay-1000"></div>
    </div>

    <!-- Signup Card -->
    <div class="relative z-10 w-full max-w-md p-4 animate-in fade-in zoom-in-95 duration-500">
      <div class="bg-card/30 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-6 md:p-8">
        <!-- Header -->
        <div class="text-center mb-6">
          <router-link to="/" class="inline-flex items-center gap-2 mb-5 group">
            <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">N</div>
            <span class="text-xl font-bold tracking-tighter">NEXUS</span>
          </router-link>
          <h1 class="text-2xl font-bold tracking-tight mb-2">{{ $t('auth.createAccount') }}</h1>
          <p class="text-muted-foreground text-sm">{{ $t('auth.signupTagline') }}</p>
        </div>

        <!-- Role Toggle -->
        <div class="flex gap-2 p-1 bg-secondary/50 rounded-xl mb-5">
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200"
            :class="role === 'user'
              ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'"
            @click="switchRole('user')"
          >
            <User class="w-4 h-4" />
            {{ $t('auth.buyer') }}
          </button>
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200"
            :class="role === 'merchant'
              ? 'bg-white dark:bg-zinc-800 shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'"
            @click="switchRole('merchant')"
          >
            <Store class="w-4 h-4" />
            {{ $t('auth.merchantRole') }}
          </button>
        </div>

        <!-- Merchant Notice -->
        <div v-if="isMerchant" class="flex items-start gap-2.5 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <ShieldAlert class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{{ $t('auth.merchantApprovalNotice') }}</span>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSignup" class="space-y-3.5" novalidate>
          <!-- Merchant: Store Name -->
          <FormField
            v-if="isMerchant"
            v-model="storeName"
            type="text"
            :label="`${t('auth.storeNameLabel')} *`"
            :placeholder="t('auth.storeNamePlaceholder')"
            :error="errors.storeName"
            :valid="isFieldValid('storeName', storeName)"
            :ref="setFieldRef('storeName')"
            @blur="validateField('storeName', targetValue($event))"
            @input="onInput('storeName', targetValue($event))"
          >
            <template #icon>
              <Store class="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            </template>
          </FormField>

          <!-- Full Name / Owner Name -->
          <FormField
            v-model="name"
            type="text"
            placeholder="John Doe"
            :error="errors.name"
            :valid="isFieldValid('name', name)"
            :ref="setFieldRef('name')"
            @blur="validateField('name', targetValue($event))"
            @input="onInput('name', targetValue($event))"
          >
            <template #label>{{ isMerchant ? t('auth.ownerNameLabel') : t('auth.fullNameLabel') }} *</template>
            <template #icon>
              <User class="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            </template>
          </FormField>

          <!-- Email -->
          <FormField
            v-model="email"
            type="email"
            :label="`${t('auth.email')} *`"
            placeholder="name@example.com"
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

          <!-- Password -->
          <FormField
            v-model="password"
            type="password"
            :label="`${t('auth.password')} *`"
            :placeholder="t('auth.passwordMinPlaceholder')"
            :error="errors.password"
            :valid="isFieldValid('password', password)"
            :ref="setFieldRef('password')"
            @blur="validateField('password', targetValue($event))"
            @input="onInput('password', targetValue($event))"
          >
            <template #icon>
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            </template>
          </FormField>

          <!-- Confirm Password -->
          <FormField
            v-model="confirmPassword"
            type="password"
            :label="`${t('auth.confirmPassword')} *`"
            :placeholder="t('auth.confirmPasswordPlaceholder')"
            :error="errors.confirmPassword"
            :valid="isFieldValid('confirmPassword', confirmPassword)"
            :ref="setFieldRef('confirmPassword')"
            @blur="validateField('confirmPassword', targetValue($event))"
            @input="onInput('confirmPassword', targetValue($event))"
          >
            <template #icon>
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            </template>
          </FormField>

          <!-- Submit -->
          <div class="pt-2">
            <div class="flex items-start gap-2 mb-4">
              <input
                type="checkbox"
                id="terms"
                v-model="termsAccepted"
                class="mt-1"
                @change="onInput('terms', String(termsAccepted))"
              />
              <label for="terms" class="text-xs text-muted-foreground leading-relaxed">
                <span v-html="$t('auth.agreeTerms')"></span>
              </label>
            </div>
            <p v-if="errors.terms" class="mt-0.5 ml-1 text-xs text-red-500">{{ errors.terms }}</p>

            <Button
              type="submit"
              class="w-full h-11 text-base shadow-lg shadow-primary/25"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ isMerchant ? $t('auth.submittingApplication') : $t('auth.creatingAccount') }}
              </span>
              <span v-else class="flex items-center justify-center gap-2">
                {{ isMerchant ? $t('auth.submitApplication') : $t('auth.createAccount') }}
                <ArrowRight class="w-4 h-4" />
              </span>
            </Button>
          </div>
        </form>

        <!-- Footer -->
        <div class="text-center mt-6 text-sm text-muted-foreground">
          {{ $t('auth.alreadyHaveAccount') }}
          <router-link :to="isMerchant ? '/merchant/login' : '/login'" class="text-primary hover:underline font-medium">{{ $t('auth.signIn') }}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
