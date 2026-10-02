package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 请求入参形态的回归网 —— 对应「把裸 JSONObject/Map 换成 DTO」那一轮。
 *
 * <p>该轮**刻意不新增任何校验规则**(只把入参从裸 Map 换成有类型的 DTO),所以本类钉的是三件事:
 * <ol>
 *   <li><b>未知字段被忽略</b>:前端会多发一些后端不读的字段(如结算摘要里的 `zip`、
 *       聊天里的 `isMerchant`、商品项里的 `price`)。这依赖 Jackson 默认不因未知字段报错
 *       (Spring Boot 关闭了 `FAIL_ON_UNKNOWN_PROPERTIES`)。把这条钉住,否则将来有人打开该开关
 *       会让前端整片 400。</li>
 *   <li><b>数字→字符串的强转不再 500</b>:既有实现用 `(String) data.get("phone")` 取手机号,
 *       请求体传数字会 `ClassCastException` → 500;换成 `String` 字段后由反序列化器强转。
 *       这是**结构改动自带的收益**,无需新增校验。</li>
 *   <li><b>原有校验与状态码不变</b>:例如结算项不合法是 <b>400</b>(入参不合法,与「业务冲突」409 区分开)、优惠码为空是 400。</li>
 * </ol>
 */
class RequestShapeTest extends BaseControllerTest {

    private static final double DELTA = 0.001;

    @Test
    @DisplayName("结算摘要:前端多发 zip、商品项多发 price 都被忽略,金额按 DB 价格重算")
    void summaryIgnoresUnknownFieldsAndUsesDbPrice() throws Exception {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("productId", 1);
        item.put("quantity", 2);
        item.put("price", 0.01);           // 前端 CartItem 带的价,必须被忽略
        item.put("name", "whatever");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", List.of(item));
        body.put("zip", "10001");          // 后端不读的字段

        // C0:该端点已移出白名单 ⇒ 必须带 token(此前用 "" 按匿名契约发,现在会 401)
        MvcResult result = post("/checkout/summary", userToken(), body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        JSONObject data = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8)).getJSONObject("data");
        // 商品 1 的 DB 价 99.00 × 2 = 198.00 —— 与请求体里传的 0.01 无关
        assertEquals(198.0, data.getDoubleValue("subtotal"), DELTA);
    }

    @Test
    @DisplayName("结算摘要:商品项用 id 而非 productId 也能识别(兼容前端 CartItem)")
    void summaryAcceptsIdFallback() throws Exception {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", 1);                  // 无 productId,回落 id
        item.put("quantity", 1);
        MvcResult result = post("/checkout/summary", userToken(), Map.of("items", List.of(item)))
                .andExpect(status().isOk())
                .andReturn();
        JSONObject data = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8)).getJSONObject("data");
        assertEquals(99.0, data.getDoubleValue("subtotal"), DELTA);
    }

    @Test
    @DisplayName("结算摘要:商品项不合法 → 400(入参不合法,与「业务冲突」409 区分开)")
    void summaryInvalidItemIsBadRequest() throws Exception {
        Map<String, Object> bad = new LinkedHashMap<>();
        bad.put("quantity", 0);             // 无商品 id 且数量为 0
        post("/checkout/summary", userToken(), Map.of("items", List.of(bad)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    @DisplayName("资料更新:手机号传数字不再 500(结构改动自带的收益)")
    void profileAcceptsNumericPhone() throws Exception {
        // 既有实现 (String) data.get("phone") 遇数字会 ClassCastException → 500;
        // 换成 String 字段后由反序列化器强转。这条证明那类 500 已消失。
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("firstName", "Shape Test");
        body.put("phone", 13800000001L);    // 数字而非字符串
        post("/account/profile", userToken(), body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("搜索:字段齐全 + 未知字段 → 200,且 page/limit 缺省按默认收敛")
    void searchAcceptsDtoAndDefaults() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("q", "Test");
        body.put("page", 1);
        body.put("limit", 5);
        body.put("sort", "price-asc");
        body.put("unknownField", "ignored");
        post("/search", "", body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.products").isArray());

        // 缺省 page/limit 也要能工作(null → 1 / 20)
        post("/search", "", Map.of("q", "Test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("退货申请:必须用**本人真实订单号**;退款金额被订单实付金额封顶")
    void returnRequestRequiresOwnOrderAndCapsRefund() throws Exception {
        // 先真实下一单,拿到 orderNo(前端 orders.ts 把 raw.orderNo 映射为 order.id)
        Map<String, Object> createBody = new LinkedHashMap<>();
        createBody.put("items", List.of(Map.of("id", 1, "quantity", 2)));
        createBody.put("channel", "card");
        String orderNo = JSONObject.parseObject(
                        post("/payments/create", userToken(), createBody)
                                .andExpect(status().isOk()).andReturn()
                                .getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data").getString("orderId");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("orderId", orderNo);
        body.put("productTitle", "Test Product 1");
        body.put("productImage", "/img/p1.jpg");
        body.put("reason", "damaged");
        body.put("detail", "arrived cracked");
        body.put("refundAmount", 99999.99);     // 远高于实付(99×2=198)→ 必须被夹到 198
        JSONObject data = JSONObject.parseObject(
                        post("/returns", userToken(), body)
                                .andExpect(status().isOk()).andReturn()
                                .getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data");
        assertEquals(orderNo, data.getString("orderId"));
        assertEquals(198.0, data.getDoubleValue("refundAmount"), DELTA);
    }

    @Test
    @DisplayName("退货申请:用不存在的订单号 → 404(此前完全不校验、静默入库)")
    void returnRequestUnknownOrderIsNotFound() throws Exception {
        post("/returns", userToken(), Map.of("orderId", "NO-SUCH-ORDER", "reason", "x"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @DisplayName("退货申请:用他人订单号 → 403(此前可为他人订单伪造退货)")
    void returnRequestOtherUsersOrderIsForbidden() throws Exception {
        Map<String, Object> createBody = new LinkedHashMap<>();
        createBody.put("items", List.of(Map.of("id", 1, "quantity", 1)));
        createBody.put("channel", "card");
        String orderNo = JSONObject.parseObject(
                        post("/payments/create", userToken(), createBody)
                                .andExpect(status().isOk()).andReturn()
                                .getResponse().getContentAsString(StandardCharsets.UTF_8))
                .getJSONObject("data").getString("orderId");

        // user2 拿 user1 的订单号提退货
        post("/returns", user2Token(), Map.of("orderId", orderNo, "reason", "x"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @DisplayName("到货订阅:前端完整载荷 → 200")
    void stockAlertAcceptsDto() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("productId", 1);
        body.put("productTitle", "Test Product 1");
        body.put("productImage", "/img/p1.jpg");
        body.put("email", "user@test.com");
        post("/stock-alerts", userToken(), body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }
}
