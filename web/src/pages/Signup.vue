<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, Github, Mail, Lock, User } from 'lucide-vue-next'

const router = useRouter()
const { toast } = useToast()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)

const handleSignup = async () => {
  if (!email.value || !password.value || !name.value) return
  
  if (password.value !== confirmPassword.value) {
    toast({
      title: 'Error',
      description: 'Passwords do not match.',
      variant: 'destructive'
    })
    return
  }

  isLoading.value = true
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  isLoading.value = false
  
  toast({
    title: 'Account created!',
    description: 'Welcome to Nexus. Please check your email to verify your account.',
    variant: 'success'
  })
  
  router.push('/')
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
      <div class="bg-card/30 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-8 md:p-10">
        <!-- Header -->
        <div class="text-center mb-8">
          <router-link to="/" class="inline-flex items-center gap-2 mb-6 group">
            <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform">N</div>
            <span class="text-xl font-bold tracking-tighter">NEXUS</span>
          </router-link>
          <h1 class="text-2xl font-bold tracking-tight mb-2">Create Account</h1>
          <p class="text-muted-foreground text-sm">Join us to experience the future of shopping</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSignup" class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Full Name</label>
            <div class="relative group">
              <User class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                v-model="name"
                type="text" 
                placeholder="John Doe"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Email</label>
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

          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Password</label>
            <div class="relative group">
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                v-model="password"
                type="password" 
                placeholder="••••••••"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">Confirm Password</label>
            <div class="relative group">
              <Lock class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                v-model="confirmPassword"
                type="password" 
                placeholder="••••••••"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>

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
                Creating account...
              </span>
              <span v-else class="flex items-center justify-center gap-2">
                Create Account <ArrowRight class="w-4 h-4" />
              </span>
            </Button>
          </div>
        </form>

        <!-- Footer -->
        <div class="text-center mt-8 text-sm text-muted-foreground">
          Already have an account? 
          <router-link to="/login" class="text-primary hover:underline font-medium">Sign in</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
