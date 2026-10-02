package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * {@code POST /account/notifications} 的契约回归网。
 *
 * <h2>先说清楚:这个端点**不是** 501</h2>
 * <p>它有真实实现({@code user_notification_pref} 落库),C5 的「诚实降级」**不覆盖**它。
 * 把 {@link NotImplementedEndpointsTest} 的 501 断言套到这里会破坏一个能用的功能 ——
 * 所以它单独成类,而不是并进那一类。
 *
 * <h2>为什么曾经被误判为「字段名不一致」(TASK-001 的教训)</h2>
 * <p>上一轮实测发现「提交 {@code {email,push,sms}} 返回 200 但 DB 零变化」,当时归因为
 * 「前后端字段名不一致」。**那个归因是错的**:{@code {email,push,sms}} 是**商家端**
 * {@code PUT /merchant/settings} 的形状(该端点已属 C5 的 501),不是买家端形状。
 * 买家侧三方本来就一致:
 * <ul>
 *   <li>前端 {@code web/src/api/modules/account.ts} 与 {@code pages/dashboard/Settings.vue}:
 *       {@code emailOrder / emailPromo / smsOrder};</li>
 *   <li>后端 {@code NotificationPrefsDTO} 与 {@code StorefrontAccountController:66-68}:
 *       {@code emailOrder / emailPromo / smsOrder};</li>
 *   <li>DB {@code user_notification_pref}:{@code email_order / email_promo / sms_order}。</li>
 * </ul>
 *
 * <h2>真正缺的是**参数校验**(C6)</h2>
 * <p>旧实现把三个字段的 {@code null} 一律当「未传」并按默认值
 * ({@code true / false / true})兜底 ⇒ <b>空 body 也会 200 且写一行默认值</b>。
 * 修复口径:三个偏好**全缺 → 400 + 明确 msg**。见
 * {@link #allFieldsMissingIsBadRequest()}。
 *
 * <h2>为什么用 user2 而不是 user1</h2>
 * <p>H2 种子里 {@code user_notification_pref} <b>没有任何行</b>,但其他测试可能对本表写入。
 * 这里统一用 {@code user2}(id=2) 并在每个用例内先断言/清理该用户的行,
 * 把「跨用例残留」排除在失败原因之外 —— 测试自身的隔离问题不该伪装成契约失败。
 *
 * <p>本类是**契约测试**:C6 落地前 {@link #allFieldsMissingIsBadRequest()} 与
 * {@link #wrongFieldNamesAreRejected()} 会红,那是正确的红(它们描述目标态),
 * 不要靠改断言让它们变绿。
 */
class AccountNotificationContractTest extends BaseControllerTest {

    /** 本类固定使用的用户 id —— 对应种子 `user` 表的 user2 */
    private static final int USER_ID = 2;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private void clearPrefs() {
        jdbcTemplate.update("DELETE FROM user_notification_pref WHERE user_id = ?", USER_ID);
    }

    // ═══════════════════ 正例:正确三字段 → 200 且真的落库 ═══════════════════

    @Test
    @DisplayName("正确三字段(emailOrder/emailPromo/smsOrder)→ 200 且 user_notification_pref 真的变化(证明它不是 501)")
    void correctFieldsArePersisted() throws Exception {
        clearPrefs();

        post("/account/notifications", user2Token(), Map.of(
                "emailOrder", false, "emailPromo", true, "smsOrder", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // DB 必须真的被改写(而不是「200 但什么都没发生」)
        Map<String, Object> row = notificationRow();
        assertNotNull(row, "应写入 user_notification_pref");
        assertEquals(0, intOf(row.get("email_order")), "email_order 应落库为 false");
        assertEquals(1, intOf(row.get("email_promo")), "email_promo 应落库为 true");
        assertEquals(0, intOf(row.get("sms_order")), "sms_order 应落库为 false");

        // GET 必须与写入一致 —— 证明落库的是服务端真值,而不是「回显请求体」
        JSONObject data = JSONObject.parseObject(
                        get("/account/notifications", user2Token())
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.code").value(200))
                                .andReturn()
                                .getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
        assertFalse(data.getBooleanValue("emailOrder"));
        assertEquals(true, data.getBooleanValue("emailPromo"));
        assertFalse(data.getBooleanValue("smsOrder"));
    }

    @Test
    @DisplayName("再次提交反向值 → 覆盖生效(upsert,不是只插不改)")
    void secondSubmitOverwrites() throws Exception {
        clearPrefs();

        post("/account/notifications", user2Token(), Map.of(
                "emailOrder", false, "emailPromo", true, "smsOrder", false))
                .andExpect(status().isOk());
        post("/account/notifications", user2Token(), Map.of(
                "emailOrder", true, "emailPromo", false, "smsOrder", true))
                .andExpect(status().isOk());

        Map<String, Object> row = notificationRow();
        assertNotNull(row, "应写入 user_notification_pref");
        assertEquals(1, intOf(row.get("email_order")), "第二次提交应覆盖第一次");
        assertEquals(0, intOf(row.get("email_promo")));
        assertEquals(1, intOf(row.get("sms_order")));

        // 同一用户只应有一行(单例语义)
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notification_pref WHERE user_id = ?", Integer.class, USER_ID);
        assertEquals(1, rows, "user_notification_pref 对同一 user 应只有一行");
    }

    // ═══════════════════ C6:缺参数校验(本轮新增契约) ═══════════════════

    @Test
    @DisplayName("C6 回归:空 body → 400(此前 200 且静默写入一行默认值)")
    void allFieldsMissingIsBadRequest() throws Exception {
        clearPrefs();

        post("/account/notifications", user2Token(), Map.of())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        // 400 的另一面:不得留下任何写入痕迹(否则就是「先写库再报错」)
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notification_pref WHERE user_id = ?", Integer.class, USER_ID);
        assertEquals(0, rows, "被拒绝的请求不得写入 user_notification_pref");
    }

    @Test
    @DisplayName("C6 回归:只有错字段名(商家端形状 email/push/sms)→ 400(不再静默吞掉并返 200)")
    void wrongFieldNamesAreRejected() throws Exception {
        clearPrefs();

        // 这三个 key 是**商家端 PUT /merchant/settings** 的形状。买家端不认它们;
        // 旧实现视为「三个 null」⇒ 按默认值兜底 ⇒ 200 且写一行默认值,用户以为偏好保存了。
        post("/account/notifications", user2Token(), Map.of(
                "email", true, "push", false, "sms", true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_notification_pref WHERE user_id = ?", Integer.class, USER_ID);
        assertEquals(0, rows, "被拒绝的请求不得写入 user_notification_pref");
    }

    @Test
    @DisplayName("C6 边界(首次提交,库中无行):只给一个字段 → 200,未给的按默认值兜底")
    void partiallyProvidedFieldsStillWork() throws Exception {
        clearPrefs();

        // 契约 C6 只把「三个全缺」定义为 400;首次提交(库中无行)时,未给的字段按默认值兜底
        // (emailOrder=true / emailPromo=false / smsOrder=true)。
        // 这条钉住「首次提交」这一分支,避免修复时把「只改一个开关」的前端用法一起拒掉。
        // ⚠️ 有行时的部分提交**不是**这个语义 —— 见 loadThenMergeKeepsExistingValues。
        post("/account/notifications", user2Token(), Map.of("emailPromo", true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        Map<String, Object> row = notificationRow();
        assertNotNull(row, "应写入 user_notification_pref");
        assertEquals(1, intOf(row.get("email_promo")), "显式给的字段必须生效");
        assertEquals(1, intOf(row.get("email_order")), "首次提交、未给的字段按默认值 true");
        assertEquals(1, intOf(row.get("sms_order")), "首次提交、未给的字段按默认值 true");
    }

    /**
     * MAJ-E3 的判别用例:后端已把 {@code updateNotificationPrefs} 改为 <b>load-then-merge</b>
     * (先读现有行,只覆盖显式给出的字段);旧实现是"把 null 一律按默认值兜底",会把未给的
     * 字段**冲回默认值**。
     *
     * <p>为什么必须新增而不是复用 {@link #partiallyProvidedFieldsStillWork}:那条用例开头
     * {@code clearPrefs()} ⇒ 库中**无行**,走的是「首次提交」分支,两种实现的输出**恰好相同**
     * (都是默认值),因此**咬不住**这个缺陷。本用例先写满一行,再做部分提交,才能区分二者。
     *
     * <p>判别标准(旧实现会得 {@code 1/0/1},那正是本用例要失败的样子):
     * <ul>
     *   <li>load-then-merge:显式给的 {@code emailPromo=false} 覆盖;**其余两个保持 {@code false}** ⇒ {@code 0/0/0}</li>
     *   <li>旧实现:未给的字段回落默认值 ⇒ {@code email_order=true(1)}、{@code sms_order=true(1)} ⇒ {@code 1/0/1}</li>
     * </ul>
     */
    @Test
    @DisplayName("MAJ-E3 回归:已有行时部分提交 → 只覆盖显式字段,其余**保留**(load-then-merge,不是回落默认值)")
    void loadThenMergeKeepsExistingValues() throws Exception {
        clearPrefs();

        // ① 先写满一行,让三个字段都**不是**默认值
        post("/account/notifications", user2Token(), Map.of(
                "emailOrder", false, "emailPromo", true, "smsOrder", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        Map<String, Object> after1 = notificationRow();
        assertNotNull(after1, "第一次提交应写入 user_notification_pref");
        assertEquals(0, intOf(after1.get("email_order")));
        assertEquals(1, intOf(after1.get("email_promo")));
        assertEquals(0, intOf(after1.get("sms_order")));

        // ② 只提交一个字段:另外两个必须**保留**(0/0),而不是回落默认值(1/1)
        post("/account/notifications", user2Token(), Map.of("emailPromo", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        Map<String, Object> after2 = notificationRow();
        assertNotNull(after2);
        assertEquals(0, intOf(after2.get("email_promo")), "显式给的字段必须被覆盖为 false");
        assertEquals(0, intOf(after2.get("email_order")),
                "未给的字段必须**保留** false;回落默认值 true 就是 MAJ-E3 复发(旧实现给 1)");
        assertEquals(0, intOf(after2.get("sms_order")),
                "未给的字段必须**保留** false;回落默认值 true 就是 MAJ-E3 复发(旧实现给 1)");
    }

    // ─────────────────────────── helpers ───────────────────────────

    /**
     * 读本类固定用户的通知偏好行;不存在返回 null。
     * 用 {@code queryForList} 而不是 {@code queryForObject} —— 后者在空结果集上抛
     * {@code EmptyResultDataAccessException},会把「没有行」变成异常而不是可断言的 null。
     */
    private Map<String, Object> notificationRow() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT email_order, email_promo, sms_order FROM user_notification_pref WHERE user_id = ?",
                USER_ID);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** H2/MySQL 下布尔列可能以 Boolean 或 0/1 返回,统一成 int 便于断言 */
    private int intOf(Object value) {
        if (value instanceof Boolean b) {
            return b ? 1 : 0;
        }
        if (value instanceof Number n) {
            return n.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }
}
