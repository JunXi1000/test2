<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag, Edit2, XCircle, Tag } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import ConfirmDialog from '@/components/ui/dialog/ConfirmDialog.vue'
import { useCartStore, type CartItem } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import EmptyState from '@/components/ui/state/EmptyState.vue'
import { getProductById } from '@/api/modules/product'
import type { Product } from '@/types/product'
import { useToast } from '@/composables/useToast'
import { usePromoCode } from '@/composables/usePromoCode'
import { useCartSummary } from '@/composables/useCartSummary'
import ErrorState from '@/components/ui/state/ErrorState.vue'
import { formatPrice } from '@/utils/format'
import { useRouter } from 'vue-router'

const MAX_QUANTITY = 99

const cartStore = useCartStore()
const authStore = useAuthStore()
const { toast } = useToast()
const { t } = useI18n()
const router = useRouter()

/** 摘要取数用的行（响应式映射，不是快照） */
const summaryItems = computed(() => cartStore.items)
// 满减档位（DISCOUNT_TIERS / getTieredDiscount / getNextTier）**已从本页移除**（2026-10-01）：
// 后端不再返回运费/税/满减，「最优档」在前端算出来就是凭空造的一笔减免。金额统一走
// useCartSummary → /checkout/summary（与结算页同一来源，见该组合式的注释）。
//
// 这里**不再单独声明本地小计**（G1b / D-1）：`subtotal` 曾经是 `cartStore.subtotal` 的别名，
// 唯一消费者是模板里 `serverSubtotal || summarySubtotal` 那个 fallback —— 而 useCartSummary
// 内部已经用同一个判据（serverLoaded）算好了展示用的小计（MIN-E1）。
// 两条判据并存只会分叉，所以只留组合式那一条。
const {
  enabled: summaryEnabled,
  isLoading: isSummaryLoading,
  error: summaryError,
  subtotal: summarySubtotal,
  discount: summaryDiscount,
  total: summaryTotal,
  fetchSummary: fetchCartSummary,
  resetSummary,
} = useCartSummary({
  items: summaryItems,
  /**
   * 与结算页 `getCode` 同形：只有**已生效**的码才发下去。
   *
   * 它同时服务三条重取路径（items 变化自动重取 / 登录后补取 / 重试），所以这里定义一次，
   * 页面其它地方一律 `fetchCartSummary()` 无参调用 —— 免得又是"三处各写一遍同样的三元"。
   * （`promoApplied`/`promoCode` 在下面才声明，但闭包只在取数时读，与 `Checkout.vue` 同构。）
   */
  getCode: () => (promoApplied.value ? promoCode.value.trim() : ''),
})

/** 减免只认服务端回的那个数（契约里它是必填，但按 0 兜底更稳） */
const tieredDiscount = computed(() => summaryDiscount.value)
const total = computed(() => summaryTotal.value)

// 优惠码整块交给 usePromoCode（与结算页共用同一套分支）。`onApplied` 让摘要在码
// 生效/移除/失效后重取 —— 减免额一律由服务端给，前端不再自己算一份。
const {
  promoCode,
  promoApplied,
  applyPromo: handleApplyPromo,
  removePromo,
  reset: resetPromo,
} = usePromoCode({
  getSubtotal: () => cartStore.subtotal,
  // 购物车这句文案与结算页的**不一样**，所以由调用方传进来（见 usePromoCode 的注释）
  alreadyAppliedDesc: t('cart.alreadyAppliedDesc'),
  // 码已生效 ⇒ 上面的 getCode 会把它带上，这里不必再拼一次
  onApplied: () => fetchCartSummary(),
})

const isLoadingRef = ref<boolean>(true)
const editDialogVisible = ref(false)
const isEditing = ref(false)
const currentEditItem = ref<CartItem | null>(null)
const editProductDetails = ref<Product | null>(null)
const editForm = reactive({
  color: '',
  size: '',
  image: '',
})

const removeConfirmVisible = ref(false)
const pendingRemoveItem = ref<CartItem | null>(null)
const clearConfirmVisible = ref(false)

onMounted(() => {
  setTimeout(() => {
    isLoadingRef.value = false
  }, 300)
  // 未登录不发（/checkout/summary 已移出白名单，匿名 401 会被拦截器当成会话失效跳登录）
  if (summaryEnabled.value) fetchCartSummary()
})

// 登录后补取一次：登录可能发生在另一个标签页 / 另一次导航，而 `onMounted` 只跑一次，
// 不补取的话页面会一直停在本地小计。退出登录则复位，别把上个会话的金额留在屏幕上。
watch(summaryEnabled, (on) => {
  if (on) fetchCartSummary()
  else resetSummary()
})

function incrementQuantity(item: CartItem) {
  if (item.quantity >= MAX_QUANTITY) {
    toast({
      title: t('cart.quantityLimit'),
      description: t('cart.quantityLimitDesc', { max: MAX_QUANTITY }),
      variant: 'destructive',
    })
    return
  }
  cartStore.updateQuantity(item.cartItemId, 1)
}

function decrementQuantity(item: CartItem) {
  if (item.quantity <= 1) {
    confirmRemove(item)
    return
  }
  cartStore.updateQuantity(item.cartItemId, -1)
}

function confirmRemove(item: CartItem) {
  pendingRemoveItem.value = item
  removeConfirmVisible.value = true
}

function executeRemove() {
  if (!pendingRemoveItem.value) return
  const title = pendingRemoveItem.value.title
  cartStore.removeItem(pendingRemoveItem.value.cartItemId)
  removeConfirmVisible.value = false
  pendingRemoveItem.value = null
  toast({ title: t('cart.itemRemoved'), description: t('cart.itemRemovedDesc', { title }) })
}

function confirmClearCart() {
  clearConfirmVisible.value = true
}

function executeClearCart() {
  cartStore.clearCart()
  clearConfirmVisible.value = false
  // 清空购物车顺带复位优惠码；这里不提示（提示语由下面那句「购物车已清空」承担）
  resetPromo()
  toast({ title: t('cart.cartCleared'), description: t('cart.cartClearedDesc') })
}

function handleCheckout() {
  if (!authStore.isAuthenticated) {
    toast({
      title: t('cart.loginRequired'),
      description: t('cart.loginRequiredDesc'),
      variant: 'destructive',
    })
    router.push({ name: 'Login', query: { redirect: '/checkout' } })
    return
  }
  router.push('/checkout')
}

/**
 * 优惠码必须先登录。
 *
 * 原因不是"产品想要"，而是**本轮契约**：`/checkout/promo`（校验折扣）与
 * `/checkout/summary`（算金额）都移出白名单，匿名一律 401。券是按用户发放的
 * （后端 `CouponServiceImpl` 要证明「这张券是我的」），匿名去核销只能得到一个
 * 永远用不掉的优惠额。所以在这里先拦，而不是让请求打到后端换一个 401。
 */
async function applyPromoWithAuth() {
  if (!authStore.isAuthenticated) {
    toast({
      title: t('cart.loginRequired'),
      description: t('cart.loginRequiredDesc'),
      variant: 'destructive',
    })
    router.push({ name: 'Login', query: { redirect: '/cart' } })
    return
  }
  await handleApplyPromo()
}

async function openEditDialog(item: CartItem) {
  currentEditItem.value = item
  editDialogVisible.value = true
  isEditing.value = true
  editProductDetails.value = null

  editForm.color = item.color
  editForm.size = item.size
  editForm.image = item.image

  try {
    const product = await getProductById(item.id)
    editProductDetails.value = product
  } catch (e) {
    toast({
      title: t('common.error'),
      description: t('cart.loadOptionsFailed'),
      variant: 'destructive',
    })
    editDialogVisible.value = false
  } finally {
    isEditing.value = false
  }
}

function saveEdit() {
  if (!currentEditItem.value) return

  if (editProductDetails.value?.colors?.length && !editForm.color) {
    toast({
      title: t('cart.selectionRequired'),
      description: t('cart.selectionRequiredDesc'),
      variant: 'destructive',
    })
    return
  }
  if (editProductDetails.value?.sizes?.length && !editForm.size) {
    toast({
      title: t('cart.selectionRequired'),
      description: t('cart.selectionRequiredSizeDesc'),
      variant: 'destructive',
    })
    return
  }

  cartStore.updateItemOptions(currentEditItem.value.cartItemId, {
    color: editForm.color,
    size: editForm.size,
    image: editForm.image,
  })

  toast({
    title: t('cart.itemUpdated'),
    description: t('cart.itemUpdatedDesc'),
    variant: 'success',
  })
  editDialogVisible.value = false
}

function selectColor(color: string) {
  editForm.color = color
  if (editProductDetails.value?.variantImages && editProductDetails.value.variantImages[color]) {
    editForm.image = editProductDetails.value.variantImages[color]
  }
}
</script>

<template>
  <div class="min-h-screen bg-background pb-20 pt-10">
    <div class="container px-4 max-w-6xl mx-auto">
      <h1 class="text-3xl font-bold tracking-tight mb-8 text-center lg:text-left">
        {{ $t('cart.title') }}
      </h1>

      <div v-if="isLoadingRef" class="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div class="lg:col-span-8 space-y-6">
          <div v-for="i in 3" :key="i" class="p-4 rounded-xl border border-border bg-card/50">
            <div class="flex gap-4">
              <Skeleton class="w-24 h-24 rounded-lg" />
              <div class="flex-1 space-y-3">
                <Skeleton class="h-5 w-1/2 rounded-md" />
                <Skeleton class="h-4 w-1/3 rounded-md" />
                <Skeleton class="h-9 w-28 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <div class="lg:col-span-4">
          <div
            class="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3"
          >
            <Skeleton class="h-6 w-1/2 rounded-md" />
            <Skeleton class="h-4 w-full rounded-md" />
            <Skeleton class="h-4 w-3/4 rounded-md" />
            <Skeleton class="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>

      <div
        v-else-if="cartStore.items.length > 0"
        class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start"
      >
        <!-- Cart Items List -->
        <div class="lg:col-span-8 space-y-4">
          <!-- Cart header bar -->
          <div class="flex justify-between items-center">
            <p class="text-sm text-muted-foreground">
              {{ $t('cart.inCart', { count: cartStore.totalItems }) }}
            </p>
            <button
              class="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-destructive/10"
              @click="confirmClearCart"
            >
              <XCircle class="w-3.5 h-3.5" />
              {{ $t('cart.clearConfirm') }}
            </button>
          </div>

          <!-- 满减进度条已移除（2026-10-01）：后端不再有满减/运费/税三样，
               「再买 $X 可减 $Y」的承诺无法兑现（也是 e2e 里
               text=/more to save|Max tier unlocked/i 断言失效的原因，见 docs/TASK-002/05-FRONTEND-FIX.md）。
               金额统一走 /checkout/summary。 -->

          <div
            v-for="item in cartStore.items"
            :key="item.cartItemId || item.id"
            class="flex gap-4 sm:gap-6 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm transition-all hover:border-primary/30"
          >
            <!-- Image -->
            <router-link
              :to="`/product/${item.id}`"
              class="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-secondary flex-shrink-0 border border-border block hover:opacity-80 transition-opacity"
            >
              <img
                :src="item.image || '/placeholder-image.jpg'"
                :alt="item.title"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="($event.target as HTMLImageElement).src = '/placeholder-image.jpg'"
              />
            </router-link>

            <!-- Content -->
            <div class="flex-1 flex flex-col justify-between">
              <div class="flex justify-between items-start gap-4">
                <div>
                  <router-link
                    :to="`/product/${item.id}`"
                    class="hover:underline hover:text-primary transition-colors"
                  >
                    <h3 class="font-bold text-lg leading-tight mb-1 text-foreground">
                      {{ item.title || $t('cart.untitled') }}
                    </h3>
                  </router-link>
                  <p class="text-sm text-muted-foreground">
                    {{ item.color || $t('cart.optionDefault') }} /
                    {{ item.size || $t('cart.optionStandard') }}
                  </p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="font-bold text-lg text-primary">
                    ${{ formatPrice(item.price * item.quantity) }}
                  </p>
                  <p v-if="item.quantity > 1" class="text-xs text-muted-foreground">
                    {{ $t('cart.eachPrice', { price: '$' + formatPrice(item.price) }) }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 mt-2">
                <button
                  class="text-xs flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                  @click="openEditDialog(item)"
                >
                  <Edit2 class="w-3 h-3" />
                  {{ $t('cart.editOptions') }}
                </button>
              </div>

              <div class="flex justify-between items-end mt-4">
                <!-- Quantity Control -->
                <div
                  class="flex items-center border border-input rounded-lg h-9 w-28 bg-background"
                >
                  <button
                    class="w-9 h-full flex items-center justify-center hover:bg-secondary rounded-l-lg transition-colors text-muted-foreground hover:text-foreground"
                    @click="decrementQuantity(item)"
                  >
                    <Minus class="w-3.5 h-3.5" />
                  </button>
                  <div class="flex-1 text-center text-sm font-medium">{{ item.quantity }}</div>
                  <button
                    :disabled="item.quantity >= MAX_QUANTITY"
                    class="w-9 h-full flex items-center justify-center hover:bg-secondary rounded-r-lg transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                    @click="incrementQuantity(item)"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </div>

                <!-- Remove -->
                <button
                  class="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                  @click="confirmRemove(item)"
                >
                  <Trash2 class="w-4 h-4" />
                  <span class="hidden sm:inline">{{ $t('common.remove') }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Continue Shopping link -->
          <div class="text-center pt-2">
            <router-link to="/" class="text-sm text-primary hover:underline transition-colors">
              &larr; {{ $t('cart.continueShopping') }}
            </router-link>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="lg:col-span-4">
          <div class="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 class="text-lg font-bold mb-6">{{ $t('cart.orderSummary') }}</h2>

            <div class="space-y-4 mb-6">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground"
                  >{{ $t('cart.subtotal') }} ({{ cartStore.totalItems }}
                  {{ cartStore.totalItems > 1 ? $t('common.items') : $t('common.item') }})</span
                >
                <!-- 小计：判据只有一条 —— useCartSummary 内部按 serverLoaded 决定用服务端回包
                     还是本地镜像（MIN-E1）。模板不再自己写 `serverSubtotal || local` 那种二次判断。 -->
                <span class="font-medium">${{ formatPrice(summarySubtotal) }}</span>
              </div>
              <!-- 运费行 / 税费行 / 本地自算的满减行已移除（2026-10-01，BLK-5）：
                   后端只回 subtotal / discount / total，前端再自算 12 元运费 + 8% 税
                   就是「购物车 689.52 ≠ 实扣 694.00」的来源。金额一律取 /checkout/summary。 -->

              <template v-if="summaryEnabled">
                <div
                  v-if="isSummaryLoading"
                  class="flex justify-between text-sm text-muted-foreground"
                >
                  <Skeleton class="h-4 w-20 rounded-md" />
                  <Skeleton class="h-4 w-16 rounded-md" />
                </div>
                <ErrorState
                  v-else-if="summaryError"
                  :message="summaryError"
                  @retry="fetchCartSummary()"
                />
                <template v-else>
                  <div v-if="tieredDiscount > 0" class="flex justify-between text-sm">
                    <span class="text-muted-foreground">{{ $t('cart.tieredDiscount') }}</span>
                    <span class="font-medium text-emerald-500"
                      >- ${{ formatPrice(tieredDiscount) }}</span
                    >
                  </div>
                  <div class="border-t border-border pt-4 flex justify-between items-center">
                    <span class="font-bold text-lg">{{ $t('cart.total') }}</span>
                    <span class="font-bold text-2xl text-primary">${{ formatPrice(total) }}</span>
                  </div>
                </template>
              </template>

              <!-- 匿名：/checkout/summary 已移出白名单（C0），取不到服务端金额。
                   此时**不给一个可能不对的应付总额**，只说明登录后可看；下方 Checkout
                   按钮本来也要求登录。 -->
              <div v-else class="rounded-lg bg-secondary/40 px-3 py-2.5 space-y-1">
                <p class="text-sm font-medium">{{ $t('cart.total') }}: —</p>
                <p class="text-xs text-muted-foreground">{{ $t('cart.loginForTotal') }}</p>
              </div>
            </div>

            <!-- Coupon Code -->
            <div v-if="!promoApplied" class="flex gap-2 mb-6">
              <input
                v-model="promoCode"
                type="text"
                :placeholder="$t('cart.promoPlaceholder')"
                class="flex-1 h-10 rounded-lg bg-secondary border border-transparent px-3 text-sm outline-none focus:border-primary transition-colors uppercase"
                @keyup.enter="applyPromoWithAuth"
              />
              <Button variant="outline" class="h-10" @click="applyPromoWithAuth">{{
                $t('common.apply')
              }}</Button>
            </div>
            <div
              v-else
              class="mb-6 flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <Tag class="w-4 h-4 text-emerald-600" />
                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-400">{{
                  promoCode.toUpperCase()
                }}</span>
                <span class="text-xs text-emerald-600"
                  >(-${{ formatPrice(tieredDiscount) }})</span
                >
              </div>
              <button
                class="text-xs text-muted-foreground hover:text-destructive transition-colors"
                @click="removePromo"
              >
                {{ $t('common.remove') }}
              </button>
            </div>

            <Button
              class="w-full h-12 text-base font-bold shadow-lg shadow-primary/20"
              data-testid="cart-checkout"
              @click="handleCheckout"
            >
              {{ $t('cart.checkout') }} <ArrowRight class="ml-2 w-4 h-4" />
            </Button>

            <p
              class="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center gap-2"
            >
              <ShoppingBag class="w-3 h-3" />
              {{ $t('cart.secureCheckout') }}
            </p>
          </div>
        </div>
      </div>

      <EmptyState
        v-else
        :icon="ShoppingBag"
        :title="$t('cart.empty')"
        :description="$t('cart.emptyHint')"
        class="py-20 max-w-3xl mx-auto"
      >
        <Button size="lg" @click="$router.push('/')">
          {{ $t('cart.startShopping') }}
        </Button>
      </EmptyState>
    </div>

    <!-- Remove Item Confirmation -->
    <ConfirmDialog
      v-model="removeConfirmVisible"
      :title="$t('cart.removeTitle')"
      :description="pendingRemoveItem?.title || ''"
      :confirm-text="$t('common.remove')"
      danger
      @confirm="executeRemove"
    >
      <template #icon><Trash2 class="w-5 h-5" /></template>
      <p v-html="$t('cart.removeDesc', { title: pendingRemoveItem?.title })"></p>
    </ConfirmDialog>

    <!-- Clear Cart Confirmation -->
    <ConfirmDialog
      v-model="clearConfirmVisible"
      :title="$t('cart.clearTitle')"
      :description="$t('cart.clearDesc')"
      :confirm-text="$t('cart.clearConfirm')"
      danger
      @confirm="executeClearCart"
    >
      <template #icon><XCircle class="w-5 h-5" /></template>
      <p v-html="$t('cart.clearConfirmDesc', { count: cartStore.totalItems })"></p>
    </ConfirmDialog>

    <!-- Edit Options Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      :title="$t('cart.editOptions')"
      width="400px"
      append-to-body
      destroy-on-close
    >
      <div v-if="isEditing" class="py-8 space-y-4">
        <Skeleton class="h-4 w-24 rounded-md" />
        <Skeleton class="h-10 w-full rounded-lg" />
        <Skeleton class="h-4 w-24 rounded-md" />
        <Skeleton class="h-10 w-full rounded-lg" />
      </div>
      <div v-else-if="editProductDetails" class="space-y-6">
        <div class="flex gap-4">
          <div class="w-20 h-20 rounded-lg overflow-hidden border border-border">
            <img
              :src="editForm.image || editProductDetails.image"
              class="w-full h-full object-cover transition-opacity duration-300"
            />
          </div>
          <div>
            <h3 class="font-bold">{{ editProductDetails.title }}</h3>
            <p class="text-primary font-bold mt-1">${{ editProductDetails.price }}</p>
          </div>
        </div>

        <div class="space-y-4">
          <div v-if="editProductDetails.colors?.length">
            <label class="text-sm font-medium mb-2 block">{{ $t('cart.colorLabel') }}</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in editProductDetails.colors"
                :key="color.name"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="
                  editForm.color === color.name
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                "
                @click="selectColor(color.name)"
              >
                {{ color.name }}
              </button>
            </div>
          </div>

          <div v-if="editProductDetails.sizes?.length">
            <label class="text-sm font-medium mb-2 block">{{ $t('cart.sizeLabel') }}</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="size in editProductDetails.sizes"
                :key="size"
                class="px-3 py-1.5 rounded-lg text-sm border transition-all"
                :class="
                  editForm.size === size
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50'
                "
                @click="editForm.size = size"
              >
                {{ size }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer flex gap-2 justify-end">
          <Button variant="outline" @click="editDialogVisible = false">{{
            $t('common.cancel')
          }}</Button>
          <Button :disabled="isEditing" @click="saveEdit">{{ $t('cart.saveChanges') }}</Button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>
