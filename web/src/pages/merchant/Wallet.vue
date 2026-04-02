<template>
  <div class="merchant-page w-full max-w-full space-y-5">
    <!-- Balances + withdraw: one grouped panel, full width -->
    <div
      class="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-100 dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:ring-white/5 sm:p-5"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h2 class="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Wallet</h2>
          <p class="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Available balance and funds still clearing.
          </p>
        </div>
        <el-button type="primary" class="w-full shrink-0 sm:w-auto" @click="dialogVisible = true">
          <ArrowUpRightIcon class="mr-2 h-4 w-4" />
          Withdraw Funds
        </el-button>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div
          class="flex items-center justify-between gap-4 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-green-50 px-4 py-4 dark:border-emerald-900/40 dark:from-emerald-950/45 dark:to-zinc-900"
        >
          <div class="min-w-0">
            <div class="text-sm font-medium text-zinc-600 dark:text-zinc-400">Available Balance</div>
            <div class="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              ${{ wallet.balance.toFixed(2) }}
            </div>
          </div>
          <div class="shrink-0 rounded-full bg-white/90 p-3 shadow-sm dark:bg-zinc-800/80">
            <DollarSignIcon class="h-7 w-7 text-emerald-600 dark:text-emerald-400 sm:h-8 sm:w-8" />
          </div>
        </div>

        <div
          class="flex items-center justify-between gap-4 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/80 px-4 py-4 dark:border-amber-900/35 dark:from-amber-950/40 dark:to-zinc-900"
        >
          <div class="min-w-0">
            <div class="text-sm font-medium text-zinc-600 dark:text-zinc-400">Pending Clearance</div>
            <div class="mt-1 text-2xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              ${{ wallet.pending.toFixed(2) }}
            </div>
          </div>
          <div class="shrink-0 rounded-full bg-white/90 p-3 shadow-sm dark:bg-zinc-800/80">
            <ClockIcon class="h-7 w-7 text-amber-600 dark:text-amber-400 sm:h-8 sm:w-8" />
          </div>
        </div>
      </div>
    </div>

    <!-- Transactions -->
    <div
      class="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-zinc-100 dark:border-zinc-700/80 dark:bg-zinc-900/70 dark:ring-white/5"
    >
      <div
        class="flex flex-col gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-700/80 sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <span class="text-base font-semibold text-zinc-900 dark:text-zinc-100">Transaction History</span>
        <el-button
          link
          type="primary"
          class="self-start sm:self-auto"
          :loading="walletRefreshing"
          @click="refreshData"
        >
          Refresh
        </el-button>
      </div>

      <div class="overflow-x-auto">
        <el-table
          :data="pagedTransactions"
          class="merchant-wallet-table"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="date" label="Date" width="112" sortable />
          <el-table-column
            prop="description"
            label="Description"
            min-width="140"
            show-overflow-tooltip
          />
          <el-table-column prop="type" label="Type" width="100" align="left">
            <template #default="{ row }">
              <el-tag :type="getTypeTag(row.type)" effect="plain" size="small" class="!font-medium">
                {{ row.type.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="Amount" width="120" align="right" sortable>
            <template #default="{ row }">
              <span
                class="font-medium tabular-nums"
                :class="row.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ row.amount >= 0 ? '+' : '' }}${{ Math.abs(row.amount).toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="Status" min-width="120" align="left">
            <template #default="{ row }">
              <div class="flex items-center justify-start gap-1.5">
                <CheckCircleIcon v-if="row.status === 'completed'" class="h-4 w-4 shrink-0 text-emerald-500" />
                <XCircleIcon v-else-if="row.status === 'failed'" class="h-4 w-4 shrink-0 text-red-500" />
                <ClockIcon v-else class="h-4 w-4 shrink-0 text-amber-500" />
                <span class="text-sm capitalize text-zinc-700 dark:text-zinc-300">{{ row.status }}</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div
        v-if="transactions.length > txPageSize"
        class="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-700/80 sm:justify-end"
      >
        <el-pagination
          v-model:current-page="txPage"
          v-model:page-size="txPageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="transactions.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </div>

    <!-- Withdrawal dialog — payout-style layout -->
    <el-dialog
      v-model="dialogVisible"
      class="merchant-withdraw-dialog"
      width="min(96vw, 56rem)"
      append-to-body
      destroy-on-close
      align-center
    >
      <template #header>
        <div class="withdraw-dialog-heading">
          <h2 class="text-xl font-semibold tracking-tight text-zinc-900">Withdraw funds</h2>
          <p class="mt-1 text-sm leading-relaxed text-zinc-500">
            Payouts use your saved destinations. Transfers usually complete within 2–5 business days.
          </p>
        </div>
      </template>

      <!-- Horizontal on lg+: left column fixed height row; right list scrolls inside -->
      <div
        class="withdraw-dialog-body flex min-h-0 w-full flex-1 flex-col gap-6 overflow-hidden lg:flex-row lg:items-stretch lg:gap-0 lg:divide-x lg:divide-zinc-200 dark:lg:divide-zinc-700"
      >
        <!-- Left: balance + amount -->
        <div class="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0 lg:pr-8">
          <div
            class="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50 to-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:from-zinc-900/80 dark:to-zinc-900"
          >
            <div class="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Available balance</div>
            <div class="mt-0.5 flex items-baseline gap-1.5">
              <span class="text-xs font-medium text-zinc-400">{{ wallet.currency }}</span>
              <span class="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
                {{ wallet.balance.toFixed(2) }}
              </span>
            </div>
            <div class="mt-2 flex items-center gap-1.5 text-[11px] leading-snug text-zinc-500">
              <ShieldCheck class="h-3 w-3 shrink-0 text-emerald-600" />
              <span>Held securely until withdrawn.</span>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Amount</label>
            <div
              class="flex overflow-hidden rounded-xl border-2 border-zinc-200 bg-white transition-colors focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/15 dark:border-zinc-600 dark:bg-zinc-900"
            >
              <span
                class="flex select-none items-center border-r border-zinc-200 bg-zinc-50 px-3 text-base font-medium text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
              >
                $
              </span>
              <el-input-number
                v-model="withdrawAmount"
                :min="10"
                :max="Math.max(10, wallet.balance)"
                :precision="2"
                :step="50"
                :controls="false"
                class="min-w-0 flex-1 withdraw-amount-input"
              />
            </div>
            <p class="mt-1 text-[11px] text-zinc-500">Minimum $10.00</p>
            <div class="mt-2.5 flex flex-wrap gap-1.5">
              <button
                v-for="q in quickWithdrawAmounts"
                :key="q"
                type="button"
                class="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                @click="setQuickWithdrawAmount(q)"
              >
                ${{ q }}
              </button>
              <button
                type="button"
                class="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-200"
                @click="setQuickWithdrawAmount(wallet.balance)"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        <!-- Right: scrollable method list + pinned “Add method” -->
        <div
          class="flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:min-h-0 lg:overflow-hidden lg:pl-8"
        >
          <label class="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >Payout destination</label
          >

          <div
            class="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]"
            role="listbox"
            :aria-activedescendant="selectedMethodId || undefined"
          >
            <div
              v-for="(m, index) in methodOptions"
              :key="m.id"
              class="withdraw-method-row flex w-full items-stretch gap-1 rounded-xl border-2 p-2 pl-2.5 transition-colors"
              :class="
                selectedMethodId === m.id
                  ? 'border-violet-500 bg-violet-50/90 dark:border-violet-500 dark:bg-violet-950/50'
                  : 'border-zinc-200 bg-white dark:border-zinc-600 dark:bg-zinc-900'
              "
            >
              <button
                :id="m.id"
                type="button"
                role="option"
                :aria-selected="selectedMethodId === m.id"
                class="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet-500"
                :class="
                  selectedMethodId === m.id
                    ? ''
                    : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50'
                "
                @click="selectedMethodId = m.id"
              >
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  <component :is="payoutMethodIcon(m)" class="h-4 w-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-sm font-medium leading-tight text-zinc-900 dark:text-zinc-100">{{
                      m.label
                    }}</span>
                    <span
                      v-if="recentMethodCount > 0 && index === 0"
                      class="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-800 dark:bg-violet-900/60 dark:text-violet-200"
                    >
                      Last
                    </span>
                  </div>
                  <p class="text-[11px] leading-tight text-zinc-500">{{ payoutMethodSubtitle(m) }}</p>
                </div>
                <Check
                  v-if="selectedMethodId === m.id"
                  class="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                  aria-hidden="true"
                />
              </button>
              <el-button
                type="danger"
                link
                class="!ml-0 shrink-0 self-center px-1.5"
                :aria-label="'Remove payout method: ' + m.label"
                @click.stop="confirmRemovePayoutMethod(m)"
              >
                <Trash2 class="h-4 w-4" />
              </el-button>
            </div>
          </div>

          <div
            class="shrink-0 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-600 dark:bg-zinc-900/30"
          >
            <div class="mb-1.5 flex items-center gap-1.5">
              <Plus class="h-3.5 w-3.5 text-zinc-500" />
              <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Add method</span>
            </div>
            <p class="mb-2 text-[10px] leading-snug text-zinc-500">
              Choose a payout type, then enter only that channel’s account. Card numbers are Luhn-checked; only
              last 4 digits are shown after save. Up to 3 recent methods on this device.
            </p>
            <div class="flex flex-col gap-2">
              <el-select v-model="addPayoutKind" class="w-full" placeholder="Payout type">
                <el-option
                  v-for="opt in payoutTypeOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-input
                v-model="addAccountInput"
                size="default"
                clearable
                :placeholder="addAccountPlaceholder"
                class="min-w-0"
                :input-style="{ fontVariantNumeric: addPayoutKind === 'bank' ? 'tabular-nums' : undefined }"
                @keyup.enter="addUserPayoutMethod"
              />
              <el-button type="primary" plain class="w-full" @click="addUserPayoutMethod">Save and use</el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="withdraw-dialog-footer flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <el-button class="w-full sm:w-auto" @click="dialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            class="w-full sm:min-w-[200px]"
            :loading="submitting"
            @click="handleWithdraw"
          >
            Withdraw ${{ withdrawAmount.toFixed(2) }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { Component } from 'vue'
import {
  ArrowUpRight as ArrowUpRightIcon,
  DollarSign as DollarSignIcon,
  Clock as ClockIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Building2,
  Globe2,
  Wallet as PayoutWalletIcon,
  Check,
  ShieldCheck,
  Plus,
  Trash2
} from 'lucide-vue-next'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  getWalletBalance, 
  getTransactions, 
  withdrawFunds,
  type MerchantWallet,
  type WalletTransaction
} from '@/api/modules/merchantWallet'

/** Payout method; user-saved entries include `kind` and masked `label`. */
type UserPayoutKind = 'bank' | 'paypal' | 'wise'

interface WithdrawMethod {
  id: string
  label: string
  kind?: UserPayoutKind
}

const WITHDRAW_MRU_KEY_V2 = 'merchant_withdraw_methods_mru_v2'
const WITHDRAW_MRU_KEY_LEGACY = 'merchant_withdraw_methods_mru_v1'
const WITHDRAW_HIDDEN_PRESETS_KEY = 'merchant_withdraw_hidden_presets_v1'
/** Only the three most recently used methods are stored and shown under “Recently used”. */
const WITHDRAW_MRU_MAX = 3

function readHiddenPresetIds(): Set<string> {
  try {
    const raw = localStorage.getItem(WITHDRAW_HIDDEN_PRESETS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeHiddenPresetIds(ids: Set<string>) {
  localStorage.setItem(WITHDRAW_HIDDEN_PRESETS_KEY, JSON.stringify([...ids]))
}

const PRESET_METHODS: WithdrawMethod[] = [
  { id: 'preset-bank', label: 'Bank account (**** 1234)' },
  { id: 'preset-paypal', label: 'PayPal (merchant@store.com)' },
  { id: 'preset-wise', label: 'Wise — multi-currency' }
]

function normalizeStoredEntry(x: unknown): WithdrawMethod | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.label !== 'string') return null
  const k = o.kind
  if (k === 'bank' || k === 'paypal' || k === 'wise') {
    return { id: o.id, label: o.label, kind: k }
  }
  if (k !== undefined) return null
  return { id: o.id, label: o.label }
}

function readWithdrawMru(): WithdrawMethod[] {
  try {
    const raw = localStorage.getItem(WITHDRAW_MRU_KEY_V2)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed
        .map(normalizeStoredEntry)
        .filter((e): e is WithdrawMethod => !!e)
        .slice(0, WITHDRAW_MRU_MAX)
    }
    const legacy = localStorage.getItem(WITHDRAW_MRU_KEY_LEGACY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown
      const migrated: WithdrawMethod[] = []
      if (Array.isArray(parsed)) {
        for (const x of parsed) {
          const n = normalizeStoredEntry(x)
          if (n && n.id.startsWith('preset-')) migrated.push(n)
        }
      }
      writeWithdrawMru(migrated)
      localStorage.removeItem(WITHDRAW_MRU_KEY_LEGACY)
      return migrated.slice(0, WITHDRAW_MRU_MAX)
    }
  } catch {
    /* ignore */
  }
  return []
}

function writeWithdrawMru(entries: WithdrawMethod[]) {
  localStorage.setItem(WITHDRAW_MRU_KEY_V2, JSON.stringify(entries.slice(0, WITHDRAW_MRU_MAX)))
}

/** Luhn (mod 10) check for payment card numbers */
function luhnValid(panDigits: string): boolean {
  const d = panDigits.replace(/\D/g, '')
  if (d.length < 13 || d.length > 19) return false
  let sum = 0
  let double = false
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i]!, 10)
    if (Number.isNaN(n)) return false
    if (double) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    double = !double
  }
  return sum % 10 === 0
}

function mergeWithdrawOptions(): WithdrawMethod[] {
  const hidden = readHiddenPresetIds()
  const mru = readWithdrawMru().filter((e) => !hidden.has(e.id))
  const seen = new Set(mru.map((e) => e.id))
  const tail = PRESET_METHODS.filter((p) => !seen.has(p.id) && !hidden.has(p.id))
  return [...mru, ...tail]
}

function recordWithdrawMethodUsed(entry: WithdrawMethod) {
  const next = readWithdrawMru().filter((e) => e.id !== entry.id)
  next.unshift({
    id: entry.id,
    label: entry.label,
    ...(entry.kind ? { kind: entry.kind } : {})
  })
  writeWithdrawMru(next)
}

const quickWithdrawAmounts = [100, 250, 500, 1000] as const

function setQuickWithdrawAmount(amount: number) {
  const max = Math.max(10, wallet.value.balance)
  const clamped = Math.min(Math.max(10, amount), max)
  withdrawAmount.value = Math.round(clamped * 100) / 100
}

function inferKindFromId(id: string): UserPayoutKind | undefined {
  if (id.startsWith('user-bank-')) return 'bank'
  if (id.startsWith('user-paypal-')) return 'paypal'
  if (id.startsWith('user-wise-')) return 'wise'
  return undefined
}

function payoutKindLabel(k: UserPayoutKind): string {
  switch (k) {
    case 'bank':
      return 'Bank card'
    case 'paypal':
      return 'PayPal'
    case 'wise':
      return 'Wise'
  }
}

function payoutMethodIcon(m: WithdrawMethod): Component {
  const k = m.kind ?? inferKindFromId(m.id)
  if (k === 'paypal') return PayoutWalletIcon
  if (k === 'wise') return Globe2
  if (k === 'bank') return Building2
  if (m.id.includes('paypal')) return PayoutWalletIcon
  if (m.id.includes('wise')) return Globe2
  return Building2
}

function payoutMethodSubtitle(m: WithdrawMethod): string {
  const k = m.kind ?? inferKindFromId(m.id)
  if (k) return `Saved on this device · ${payoutKindLabel(k)}`
  return 'Connected payout account'
}

const payoutTypeOptions = [
  { value: 'bank' as const, label: 'Bank card' },
  { value: 'paypal' as const, label: 'PayPal' },
  { value: 'wise' as const, label: 'Wise' }
]

function emailValid(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || local === undefined) return email
  if (local.length <= 1) return `*@${domain}`
  if (local.length === 2) return `${local[0]}*@${domain}`
  return `${local[0]}***${local.slice(-1)}@${domain}`
}

function buildUserPayoutMethod(
  kind: UserPayoutKind,
  raw: string
): { entry: WithdrawMethod } | { error: string } {
  const id = `user-${kind}-${Date.now()}`
  switch (kind) {
    case 'bank': {
      const d = raw.replace(/\D/g, '')
      if (d.length < 13 || d.length > 19) {
        return { error: 'Card number must be 13–19 digits.' }
      }
      if (!luhnValid(d)) {
        return { error: 'Card number did not pass the Luhn check.' }
      }
      const last4 = d.slice(-4)
      return { entry: { id, kind, label: `Bank card · **** ${last4}` } }
    }
    case 'paypal': {
      const e = raw.trim().toLowerCase()
      if (!emailValid(e)) {
        return { error: 'Enter a valid PayPal email.' }
      }
      return { entry: { id, kind, label: `PayPal · ${maskEmail(e)}` } }
    }
    case 'wise': {
      const t = raw.trim()
      if (!t) {
        return { error: 'Enter a Wise email or account reference.' }
      }
      const lower = t.toLowerCase()
      if (emailValid(lower)) {
        return { entry: { id, kind, label: `Wise · ${maskEmail(lower)}` } }
      }
      if (!/^[a-zA-Z0-9._-]{3,80}$/.test(t)) {
        return { error: 'Reference: 3–80 letters, digits, dot, hyphen, or underscore.' }
      }
      const masked = t.length <= 5 ? `${t[0]}···` : `${t.slice(0, 2)}···${t.slice(-2)}`
      return { entry: { id, kind, label: `Wise · ${masked}` } }
    }
  }
}

// State
const wallet = ref<MerchantWallet>({ balance: 0, pending: 0, currency: 'USD' })
const transactions = ref<WalletTransaction[]>([])
const walletRefreshing = ref(false)
const txPage = ref(1)
const txPageSize = ref(10)

const pagedTransactions = computed(() => {
  const start = (txPage.value - 1) * txPageSize.value
  return transactions.value.slice(start, start + txPageSize.value)
})
const dialogVisible = ref(false)
const withdrawAmount = ref(100)
const methodOptions = ref<WithdrawMethod[]>([])
/** MRU length; first `recentMethodCount` rows in `methodOptions` are recent (show Last / Recent tags). */
const recentMethodCount = ref(0)
const selectedMethodId = ref('')
const addPayoutKind = ref<UserPayoutKind>('bank')
const addAccountInput = ref('')
const submitting = ref(false)

const addAccountPlaceholder = computed(() => {
  switch (addPayoutKind.value) {
    case 'bank':
      return 'Card number (13–19 digits)'
    case 'paypal':
      return 'PayPal email'
    case 'wise':
      return 'Wise email or reference ID'
  }
})

function refreshWithdrawMethods() {
  const hidden = readHiddenPresetIds()
  const mru = readWithdrawMru().filter((e) => !hidden.has(e.id))
  recentMethodCount.value = mru.length
  methodOptions.value = mergeWithdrawOptions()
  const ok = methodOptions.value.some((m) => m.id === selectedMethodId.value)
  if (!ok && methodOptions.value.length) {
    selectedMethodId.value = methodOptions.value[0]!.id
  } else if (!methodOptions.value.length) {
    selectedMethodId.value = ''
  }
}

function removePayoutMethod(entry: WithdrawMethod) {
  if (entry.id.startsWith('preset-')) {
    const hidden = readHiddenPresetIds()
    hidden.add(entry.id)
    writeHiddenPresetIds(hidden)
  }
  const next = readWithdrawMru().filter((e) => e.id !== entry.id)
  writeWithdrawMru(next)
  refreshWithdrawMethods()
}

async function confirmRemovePayoutMethod(m: WithdrawMethod) {
  try {
    await ElMessageBox.confirm(
      `Remove “${m.label}” from this device? You can add it again later.`,
      'Remove payout method',
      {
        type: 'warning',
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        distinguishCancelAndClose: true
      }
    )
  } catch {
    return
  }
  removePayoutMethod(m)
  ElMessage.success('Payout method removed')
}

watch(dialogVisible, (open) => {
  if (open) {
    addPayoutKind.value = 'bank'
    addAccountInput.value = ''
    refreshWithdrawMethods()
  }
})

watch([() => transactions.value.length, txPageSize], () => {
  const total = transactions.value.length
  const maxPage = Math.max(1, Math.ceil(total / txPageSize.value) || 1)
  if (txPage.value > maxPage) txPage.value = maxPage
})

function addUserPayoutMethod() {
  const raw = addAccountInput.value.trim()
  if (!raw) {
    ElMessage.warning('Enter the account for this payout type')
    return
  }
  const built = buildUserPayoutMethod(addPayoutKind.value, addAccountInput.value)
  if ('error' in built) {
    ElMessage.warning(built.error)
    return
  }
  recordWithdrawMethodUsed(built.entry)
  addAccountInput.value = ''
  refreshWithdrawMethods()
  selectedMethodId.value = built.entry.id
  ElMessage.success('Saved. It will stay at the top of the list after each use.')
}

// Methods
const loadData = async (options?: { showRefreshing?: boolean }) => {
  if (options?.showRefreshing) walletRefreshing.value = true
  try {
    const [balanceData, txData] = await Promise.all([
      getWalletBalance(),
      getTransactions()
    ])
    wallet.value = balanceData
    transactions.value = txData
    txPage.value = 1
  } catch (error) {
    ElMessage.error('Failed to load wallet data')
  } finally {
    if (options?.showRefreshing) walletRefreshing.value = false
  }
}

const refreshData = () => {
  loadData({ showRefreshing: true })
}

const getTypeTag = (type: string) => {
  switch (type) {
    case 'sale': return 'success'
    case 'withdrawal': return 'info'
    case 'refund': return 'danger'
    case 'fee': return 'warning'
    default: return 'info'
  }
}

const handleWithdraw = async () => {
  if (withdrawAmount.value > wallet.value.balance) {
    ElMessage.warning('Insufficient funds')
    return
  }

  const entry = methodOptions.value.find((m) => m.id === selectedMethodId.value)
  if (!entry) {
    ElMessage.warning('Choose a payout method')
    return
  }

  submitting.value = true
  try {
    await withdrawFunds(withdrawAmount.value, {
      destinationId: entry.id,
      destinationLabel: entry.label
    })
    recordWithdrawMethodUsed(entry)
    ElMessage.success('Withdrawal request submitted')
    dialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error('Withdrawal failed')
  } finally {
    submitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<style scoped>
:deep(.withdraw-amount-input.el-input-number) {
  width: 100%;
}

:deep(.merchant-wallet-table .el-table__cell) {
  padding-top: 0.65rem;
  padding-bottom: 0.65rem;
}

:deep(.merchant-wallet-table .el-table__header th.el-table__cell) {
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>

<style>
.merchant-withdraw-dialog.el-dialog {
  border-radius: 1rem;
  padding: 0;
  margin-top: 5vh;
  margin-bottom: 5vh;
  max-height: min(92dvh, 760px);
  display: flex;
  flex-direction: column;
}

.merchant-withdraw-dialog .el-dialog__header {
  flex-shrink: 0;
  padding: 1rem 1.25rem 0.5rem;
  margin-right: 0;
}

.merchant-withdraw-dialog .withdraw-dialog-heading {
  padding-right: 2rem;
}

.merchant-withdraw-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 1.25rem 0.75rem;
  overflow: hidden;
}

.merchant-withdraw-dialog .withdraw-dialog-body {
  scrollbar-gutter: stable;
}

/* Narrow: whole form scrolls as one block inside the dialog body */
@media (max-width: 1023.98px) {
  .merchant-withdraw-dialog .withdraw-dialog-body {
    overflow-y: auto;
    overflow-x: hidden;
  }
}

.merchant-withdraw-dialog .el-dialog__footer {
  flex-shrink: 0;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid rgb(228 228 231 / 0.8);
}

.merchant-withdraw-dialog .withdraw-amount-input.el-input-number .el-input__wrapper {
  box-shadow: none !important;
  background: transparent;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.merchant-withdraw-dialog .withdraw-amount-input .el-input__inner {
  height: 2.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  text-align: left;
  line-height: 1.2;
}
</style>
