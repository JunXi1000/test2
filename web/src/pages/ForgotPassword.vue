<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, Mail } from 'lucide-vue-next'
import { requestPasswordReset, MOCK_PASSWORD_RESET_TOKEN } from '@/api/modules/auth'
import { USE_MOCK } from '@/config/env'

const router = useRouter()
const { toast } = useToast()

const email = ref('')
const isLoading = ref(false)
const isSent = ref(false)

const handleReset = async () => {
  if (!email.value) return

  isLoading.value = true
  try {
    await requestPasswordReset(email.value.trim())
    isSent.value = true
    toast({
      title: '邮件已发送',
      description: '若该邮箱已注册，您将收到重置说明（含垃圾邮件箱）。',
      variant: 'success'
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '发送失败，请稍后重试。'
    toast({ title: '发送失败', description: msg, variant: 'destructive' })
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
          <h1 class="text-2xl font-bold tracking-tight mb-2">忘记密码？</h1>
          <p class="text-muted-foreground text-sm">
            {{ isSent ? '请查收邮箱' : '输入注册邮箱，我们将发送重置链接' }}
          </p>
        </div>

        <div v-if="isSent" class="text-center space-y-6">
          <div class="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-sm border border-emerald-500/20 text-left space-y-2">
            <p>
              若 <strong>{{ email }}</strong> 已在系统中注册，您将收到一封包含重置链接的邮件，请检查收件箱与垃圾邮件文件夹。
            </p>
            <p v-if="USE_MOCK" class="text-xs text-muted-foreground border-t border-emerald-500/20 pt-2 mt-2">
              当前为 Mock 模式，不会真实发信。可点击下面链接模拟从邮件打开「设置新密码」页：
            </p>
            <router-link
              v-if="USE_MOCK"
              :to="{ name: 'ResetPassword', query: { token: MOCK_PASSWORD_RESET_TOKEN } }"
              class="inline-block text-sm text-primary font-medium hover:underline"
            >
              打开重置密码页（测试用）
            </router-link>
          </div>
          <Button @click="router.push('/login')" class="w-full">返回登录</Button>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleReset" class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">邮箱</label>
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
              发送中…
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              发送重置链接 <ArrowRight class="w-4 h-4" />
            </span>
          </Button>
        </form>

        <!-- Footer -->
        <div v-if="!isSent" class="text-center mt-8 text-sm text-muted-foreground">
          想起密码了？
          <router-link to="/login" class="text-primary hover:underline font-medium">去登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
