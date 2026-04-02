<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import Button from '@/components/ui/button/Button.vue'
import { ArrowRight, Lock } from 'lucide-vue-next'
import { resetPasswordWithToken } from '@/api/modules/auth'

const route = useRoute()
const router = useRouter()
const { toast } = useToast()

const token = computed(() => {
  const t = route.query.token
  if (typeof t === 'string') return t
  if (Array.isArray(t) && typeof t[0] === 'string') return t[0]
  return ''
})

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const done = ref(false)

const canSubmit = computed(() => token.value.trim().length > 0)

async function handleSubmit() {
  if (!canSubmit.value) return
  if (password.value.length < 8) {
    toast({
      title: '密码过短',
      description: '请至少使用 8 位密码。',
      variant: 'destructive'
    })
    return
  }
  if (password.value !== confirmPassword.value) {
    toast({
      title: '不一致',
      description: '两次输入的密码不一致。',
      variant: 'destructive'
    })
    return
  }

  isLoading.value = true
  try {
    await resetPasswordWithToken(token.value, password.value)
    done.value = true
    toast({
      title: '已更新密码',
      description: '请使用新密码登录。',
      variant: 'success'
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '重置失败，请稍后重试或重新申请邮件。'
    toast({ title: '重置失败', description: msg, variant: 'destructive' })
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
            <h1 class="text-2xl font-bold tracking-tight mb-2">链接无效</h1>
            <p class="text-muted-foreground text-sm">缺少重置口令。请从邮件中的链接打开，或重新申请重置邮件。</p>
            <div class="mt-6 space-y-3">
              <Button class="w-full" @click="router.push({ name: 'ForgotPassword' })">重新发送重置邮件</Button>
              <Button variant="outline" class="w-full" @click="router.push({ name: 'Login' })">返回登录</Button>
            </div>
          </template>

          <template v-else-if="done">
            <h1 class="text-2xl font-bold tracking-tight mb-2">密码已更新</h1>
            <p class="text-muted-foreground text-sm">现在可以使用新密码登录账户。</p>
            <Button class="w-full mt-6" @click="router.push({ name: 'Login' })">前往登录</Button>
          </template>

          <template v-else>
            <h1 class="text-2xl font-bold tracking-tight mb-2">设置新密码</h1>
            <p class="text-muted-foreground text-sm">请输入新密码（至少 8 位）</p>
          </template>
        </div>

        <form v-if="canSubmit && !done" @submit.prevent="handleSubmit" class="space-y-4">
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">新密码</label>
            <div class="relative group">
              <Lock
                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                v-model="password"
                type="password"
                autocomplete="new-password"
                placeholder="至少 8 位"
                minlength="8"
                class="w-full h-10 bg-secondary/50 border border-transparent rounded-xl pl-10 pr-4 text-sm outline-none focus:border-primary/50 focus:bg-secondary transition-all"
                required
              />
            </div>
          </div>
          <div class="space-y-2">
            <label class="text-xs font-medium uppercase tracking-wider text-muted-foreground ml-1">确认新密码</label>
            <div class="relative group">
              <Lock
                class="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors"
              />
              <input
                v-model="confirmPassword"
                type="password"
                autocomplete="new-password"
                placeholder="再次输入"
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
              提交中…
            </span>
            <span v-else class="flex items-center justify-center gap-2">
              确认新密码 <ArrowRight class="w-4 h-4" />
            </span>
          </Button>
        </form>

        <div v-if="canSubmit && !done" class="text-center mt-8 text-sm text-muted-foreground">
          <router-link to="/login" class="text-primary hover:underline font-medium">返回登录</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
