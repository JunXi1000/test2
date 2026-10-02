import { computed } from 'vue'
import { RUNTIME_USE_MOCK } from '@/config/env'

/**
 * 某个**写**端点在本环境里会不会真的打到一个「尚未实现」的后端（501）。
 *
 * 背景（TASK-002 / C5）：`PUT /admin/settings`、`PUT /merchant/settings`、
 * `POST /merchant/wallet/withdraw`、`PUT /addresses/{id}/default` 四处按契约改为
 * **501 Not Implemented** —— 此前它们收下请求体、什么都不写就返回 200，
 * 用户看到「已保存 / 已受理」而数据库零变化（`docs/TASK-002/06a-TEST-SYNC.md` §4）。
 *
 * 判定依据是**写请求是否会真的出网**，即 `RUNTIME_USE_MOCK`（它既是运行时开关，
 * 又是 `USE_MOCK` 的初值，见 `config/env.ts`）。为什么这正是正确的判据：这三个模块的写函数
 * **都先判它再发请求**（`adminSettings.ts:24`、`merchantSettings.ts:52`、`merchantWallet.ts:83`）——
 *   - `RUNTIME_USE_MOCK === false` ⇒ 真发 HTTP ⇒ 真实后端必回 501 ⇒ **必须禁用 + 说明**；
 *   - `RUNTIME_USE_MOCK === true`  ⇒ 本地模拟成功，请求**根本不出网** ⇒ 保留可用（演示/联调）。
 * 直接钉死会让 mock 下的功能整块失效，而那不是「对用户撒谎」——是对模拟实现的正常使用。
 *
 * ⚠️ **已知偏差（显式记录；Review Gate MIN-E3）**：这个判据代理的是「模块是否走 mock 分支」，
 * 而不是直接问「后端实现了没有」。二者在今天等价（三个模块都用 `RUNTIME_USE_MOCK`），
 * 但以下组合会让它们分叉：
 *   1. 「真实后端 + `RUNTIME_USE_MOCK=true`」：UI 放行，而写请求被本地 mock 顶掉 ——
 *      用户看到"保存成功"、数据并没有落到后端。**不会吃到 501，但也不是真保存**；
 *   2. 将来某个模块改用 build-time `USE_MOCK` 判定：运行时开关关不掉它，判据失配。
 * 真到那一天，正确做法是「以端点能力为准」（例如探测一次 501 后缓存结果），
 * 而不是继续用传输层开关代理。当前三个页面的点击处理里都保留了**二次守卫**
 * （`handleSave` / `handleWithdraw` 内再判一次并给明确提示），所以即便分叉也不会静默"成功"。
 *
 * 注意它**只用于写端点**：`GET /admin/settings` 与 `GET /merchant/settings`
 * 仍可读（硬编码），页面必须能区分「读得到但写不了」。
 */
export function useWriteEndpointAvailability() {
  /** 写请求是否真的会打到后端（= 传输层没有被 mock 顶掉） */
  const hitsRealBackend = computed(() => !RUNTIME_USE_MOCK.value)
  /** 真实后端下这些写端点都是 501 ⇒ 不可用；mock 下由本地模拟承担 */
  const isWriteImplemented = computed(() => !hitsRealBackend.value)

  /** 不可用时的稳定说明：用户看得懂「现在用不了」，也知道不是自己的操作问题 */
  const notImplementedHint = computed(() =>
    hitsRealBackend.value
      ? 'Saving is not available yet — this endpoint is not implemented on the server, so nothing would be stored.'
      : '',
  )

  return { isWriteImplemented, hitsRealBackend, notImplementedHint }
}
