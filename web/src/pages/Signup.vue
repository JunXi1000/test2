<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { register as registerApi } from '@/api/modules/auth'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, Mail, Lock, User, Store, ShieldAlert } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { toast } = useToast()

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
}

const handleSignup = async () => {
  errorMessage.value = ''

  // Validation
  if (!email.value || !password.value || !name.value) {
    errorMessage.value = 'Please fill in all required fields.'
    return
  }

  if (isMerchant.value && !storeName.value.trim()) {
    errorMessage.value = 'Please enter your store name.'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  isLoading.value = true

  try {
    await registerApi({
      role: role.value,
      email: email.value,
      password: password.value,
      nickname: name.value,
      storeName: isMerchant.value ? storeName.value : undefined
    })

    const accountType = isMerchant.value ? 'merchant' : ''
    const notice = isMerchant.value
      ? 'Your store has been submitted for review. An administrator will approve it shortly.'
      : 'You can now sign in and start shopping.'

    toast({
      title: isMerchant.value ? 'Store registration submitted!' : 'Account created!',
      description: notice,
      variant: 'success'
    })

    // Redirect to login
    const loginPath = isMerchant.value ? '/merchant/login' : '/login'
    router.push(loginPath)
  } catch (err: any) {
    const msg = err?.message || 'Registration failed. Please try again.'
    errorMessage.value = msg
    toast({
      title: 'Registration failed',
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
          <h1 class="text-2xl font-bold tracking-tight mb-2">Create Account</h1>
          <p class="text-muted-foreground text-sm">Join us to experience the future of shopping</p>
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
            Buyer
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
            Merchant
          </button>
        </div>

        <!-- Merchant Notice -->
        <div v-if="isMerchant" class="flex items-start gap-2.5 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <ShieldAlert class="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Merchant registrations require admin approval before your store goes live. This usually takes 1-2 business days.</span>
        </div>

        <!-- Error message -->
        <div v-if="errorMessage" class="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSignup" class="space-y-3.5">
          <!-- Merchant: Store Name -->
          <div v-if="isMerchant" class="space-y-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Store Name *</label>
            <div class="relative group">
              <Store class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="storeName"
                type="text"
                placeholder="My Awesome Store"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <!-- Full Name / Owner Name -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">
              {{ isMerchant ? 'Owner Name *' : 'Full Name *' }}
            </label>
            <div class="relative group">
              <User class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="name"
                type="text"
                :placeholder="isMerchant ? 'John Doe' : 'John Doe'"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <!-- Email -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Email *</label>
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

          <!-- Password -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Password *</label>
            <div class="relative group">
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="password"
                type="password"
                placeholder="Minimum 6 characters"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
                minlength="6"
              />
            </div>
          </div>

          <!-- Confirm Password -->
          <div class="space-y-1.5">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Confirm Password *</label>
            <div class="relative group">
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <!-- Submit -->
          <div class="pt-2">
            <div class="flex items-start gap-2 mb-4">
              <input type="checkbox" id="terms" class="mt-1" required />
              <label for="terms" class="text-xs text-muted-foreground leading-relaxed">
                I agree to the <a href="#" class="text-primary hover:underline">Terms of Service</a> and <a href="#" class="text-primary hover:underline">Privacy Policy</a>.
              </label>
            </div>

            <Button
              type="submit"
              class="w-full h-11 text-base shadow-lg shadow-primary/25"
              :disabled="isLoading"
            >
              <span v-if="isLoading" class="flex items-center gap-2">
                <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ isMerchant ? 'Submitting application...' : 'Creating account...' }}
              </span>
              <span v-else class="flex items-center justify-center gap-2">
                {{ isMerchant ? 'Submit Application' : 'Create Account' }}
                <ArrowRight class="w-4 h-4" />
              </span>
            </Button>
          </div>
        </form>

        <!-- Footer -->
        <div class="text-center mt-6 text-sm text-muted-foreground">
          Already have an account?
          <router-link :to="isMerchant ? '/merchant/login' : '/login'" class="text-primary hover:underline font-medium">Sign in</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
