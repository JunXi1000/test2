<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import { useToast } from '@/composables/useToast'
import { Camera } from 'lucide-vue-next'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { getProfile, updateProfile as apiUpdateProfile, getNotificationPrefs, updateNotificationPrefs } from '@/api/modules/account'
import ErrorState from '@/components/ui/state/ErrorState.vue'

const { toast } = useToast()

const profile = ref({
  firstName: 'Alex',
  lastName: 'Doe',
  email: 'alex.doe@example.com',
  phone: '+1 (555) 123-4567',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop'
})

const password = ref({
  current: '',
  new: '',
  confirm: ''
})

const notifications = ref({
  emailOrder: true,
  emailPromo: false,
  smsOrder: true
})

const updateProfile = async () => {
  try {
    await apiUpdateProfile(profile.value)
    toast({ title: 'Profile Updated', description: 'Your personal information has been saved.', variant: 'success' })
  } catch (e: any) {
    toast({ title: 'Save failed', description: e?.message || 'Unknown error', variant: 'destructive' })
  }
}

async function saveNotificationPrefs() {
  try {
    await updateNotificationPrefs(notifications.value)
    toast({ title: 'Preferences Updated', description: 'Notification preferences saved.', variant: 'success' })
  } catch (e: any) {
    toast({ title: 'Update failed', description: e?.message || 'Unknown error', variant: 'destructive' })
  }
}

const updatePassword = () => {
  if (password.value.new !== password.value.confirm) {
    toast({
      title: 'Error',
      description: 'New passwords do not match.',
      variant: 'destructive'
    })
    return
  }
  
  toast({
    title: 'Password Changed',
    description: 'Your password has been updated securely.',
    variant: 'success'
  })
  
  password.value = { current: '', new: '', confirm: '' }
}

const handleAvatarUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      profile.value.avatar = e.target?.result as string
      toast({
        title: 'Avatar Updated',
        description: 'Your profile picture has been changed.',
        variant: 'success'
      })
    }
    reader.readAsDataURL(file)
  }
}

const isLoadingRef = ref<boolean>(true)
const errorRef = ref<string>('')

async function fetchSettings() {
  try {
    isLoadingRef.value = true
    errorRef.value = ''
    const [p, prefs] = await Promise.all([getProfile(), getNotificationPrefs()])
    Object.assign(profile.value, p)
    Object.assign(notifications.value, prefs)
  } catch (e: any) {
    errorRef.value = e?.message || 'Failed to load settings'
  } finally {
    isLoadingRef.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <div class="space-y-10 max-w-2xl">
    <div v-if="isLoadingRef" class="space-y-10">
      <div>
        <Skeleton class="h-8 w-48 rounded-md mb-6" />
        <div class="flex items-center gap-6 mb-6">
          <Skeleton class="w-20 h-20 rounded-full" />
          <div class="space-y-2">
            <Skeleton class="h-4 w-36 rounded-md" />
            <Skeleton class="h-3 w-28 rounded-md" />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton class="h-10 rounded-lg" />
          <Skeleton class="h-10 rounded-lg" />
          <Skeleton class="h-10 rounded-lg" />
          <Skeleton class="h-10 rounded-lg" />
        </div>
        <div class="flex justify-end mt-4">
          <Skeleton class="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <div>
        <Skeleton class="h-8 w-44 rounded-md mb-6" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton class="h-10 rounded-lg" />
          <Skeleton class="h-10 rounded-lg" />
          <Skeleton class="h-10 rounded-lg" />
        </div>
        <div class="flex justify-end mt-4">
          <Skeleton class="h-9 w-40 rounded-lg" />
        </div>
      </div>
      <div>
        <Skeleton class="h-8 w-36 rounded-md mb-6" />
        <div class="space-y-4">
          <Skeleton class="h-6 w-full rounded-lg" />
          <Skeleton class="h-6 w-full rounded-lg" />
          <Skeleton class="h-6 w-full rounded-lg" />
        </div>
      </div>
    </div>
    <ErrorState v-else-if="errorRef" :message="errorRef" @retry="fetchSettings" />
    <template v-else>
    <div>
      <h1 class="text-2xl font-bold mb-6">Account Settings</h1>
      
      <!-- Profile Form -->
      <section class="space-y-6">
        
        <!-- Avatar Upload -->
        <div class="flex items-center gap-6 mb-6">
          <div class="relative group cursor-pointer">
            <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
              <img :src="profile.avatar" alt="Avatar" class="w-full h-full object-cover" />
            </div>
            <div class="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera class="w-6 h-6 text-white" />
            </div>
            <input type="file" class="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" @change="handleAvatarUpload" />
          </div>
          <div>
            <h3 class="font-medium">Profile Picture</h3>
            <p class="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="text-sm font-medium">First Name</label>
            <input v-model="profile.firstName" type="text" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Last Name</label>
            <input v-model="profile.lastName" type="text" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Email Address</label>
            <input v-model="profile.email" type="email" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Phone Number</label>
            <input v-model="profile.phone" type="tel" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
        </div>
        <div class="flex justify-end">
          <Button @click="updateProfile">Save Changes</Button>
        </div>
      </section>
    </div>

    <!-- Password Form -->
    <section class="space-y-6">
      <h2 class="text-lg font-semibold border-b border-border pb-2">Change Password</h2>
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Current Password</label>
          <input v-model="password.current" type="password" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="text-sm font-medium">New Password</label>
            <input v-model="password.new" type="password" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Confirm New Password</label>
            <input v-model="password.confirm" type="password" class="w-full h-10 rounded-lg bg-background border border-input px-3 text-sm focus:ring-2 focus:ring-primary outline-none" />
          </div>
        </div>
      </div>
      <div class="flex justify-end">
        <Button variant="outline" @click="updatePassword">Update Password</Button>
      </div>
    </section>

    <!-- Notifications -->
    <section class="space-y-6">
      <h2 class="text-lg font-semibold border-b border-border pb-2">Notifications</h2>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">Order Updates</p>
            <p class="text-xs text-muted-foreground">Receive email updates about your order status.</p>
          </div>
          <input type="checkbox" v-model="notifications.emailOrder" class="toggle" @change="saveNotificationPrefs" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">Promotions</p>
            <p class="text-xs text-muted-foreground">Receive emails about new products and sales.</p>
          </div>
          <input type="checkbox" v-model="notifications.emailPromo" class="toggle" @change="saveNotificationPrefs" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sm">SMS Notifications</p>
            <p class="text-xs text-muted-foreground">Receive text messages for delivery updates.</p>
          </div>
          <input type="checkbox" v-model="notifications.smsOrder" class="toggle" @change="saveNotificationPrefs" />
        </div>
      </div>
    </section>
    </template>
  </div>
</template>

<style scoped>
.toggle {
  appearance: none;
  width: 40px;
  height: 24px;
  border-radius: 12px;
  background-color: hsl(var(--secondary));
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
}

.toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.toggle:checked {
  background-color: hsl(var(--primary));
}

.toggle:checked::after {
  transform: translateX(16px);
}
</style>
