package com.project.platform.controller;

import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.project.platform.mapper.ProductMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 2 主链路真实落库验证(禁用 mock):
 * /payments/create 下单 → /confirm 支付 → 重复确认幂等 → /orders 可见 → 库存原子扣减;
 * 取消越权(user2 取消 user1 订单)被归属校验拒绝。
 */
class StorefrontPaymentControllerTest extends BaseControllerTest {

    @Autowired
    private ProductMapper productMapper;

    /** POST /payments/create,返回完整响应体(ResponseVO) */
    private JSONObject createPayment(String token, int productId, int qty) throws Exception {
        Map<String, Object> body = Map.of(
                "items", List.of(Map.of("id", productId, "quantity", qty)),
                "channel", "card"
        );
        MvcResult result = post("/payments/create", token, body)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return JSONObject.parseObject(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("下单→支付→幂等确认→订单可见→库存扣减(全链路)")
    void createConfirmIdempotentAndList() throws Exception {
        String token = userToken();
        int stockBefore = productMapper.selectById(1).getStock();

        // ① 下单:DB 价格重算 amount=99*2=198,生成真实 orderNo
        JSONObject create = createPayment(token, 1, 2);
        JSONObject data = create.getJSONObject("data");
        String orderNo = data.getString("orderId");
        assertNotNull(orderNo);
        assertFalse(orderNo.isEmpty());
        assertTrue(orderNo.startsWith("NO"), "orderNo 应由 OrderNoGenerator 生成, got: " + orderNo);
        assertEquals(198.0, data.getDoubleValue("amount"), 0.001);

        // ② 库存原子扣减 2(乐观锁防超卖)
        int stockAfter = productMapper.selectById(1).getStock();
        assertEquals(stockBefore - 2, stockAfter);

        // ③ 确认支付(channel=card 模拟网关:待支付→待发货)
        JSONObject confirm = confirm(token, orderNo);
        assertEquals("succeeded", confirm.getJSONObject("data").getString("status"));
        assertEquals(orderNo, confirm.getJSONObject("data").getString("orderId"));

        // ④ 幂等:重复确认仍 succeeded(已支付直接返回,不重复扣款/改单)
        JSONObject confirm2 = confirm(token, orderNo);
        assertEquals("succeeded", confirm2.getJSONObject("data").getString("status"));

        // ⑤ /orders 能查到该分组订单(待发货、total=198、quantity=2)
        JSONObject target = findOrder(token, orderNo);
        assertNotNull(target, "/orders 应包含 orderNo " + orderNo);
        assertEquals("待发货", target.getString("status"));
        assertEquals(198.0, target.getDoubleValue("totalMoney"), 0.001);
        assertEquals(2, target.getIntValue("quantity"));
    }

    @Test
    @DisplayName("取消越权:user2 不能取消 user1 的订单(403)")
    void cancelByOtherUserForbidden() throws Exception {
        JSONObject create = createPayment(userToken(), 2, 1);
        String orderNo = create.getJSONObject("data").getString("orderId");
        assertNotNull(orderNo);

        // user2 取消 user1 的订单 → AccessGuard 归属校验拒绝(403)
        post("/orders/" + orderNo + "/cancel", user2Token(), Map.of())
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private JSONObject confirm(String token, String orderNo) throws Exception {
        MvcResult result = post("/payments/confirm", token, Map.of("orderId", orderNo, "channel", "card"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return JSONObject.parseObject(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    /** 在 GET /orders 结果中按 orderNo 找到分组订单,不存在返回 null */
    private JSONObject findOrder(String token, String orderNo) throws Exception {
        MvcResult result = get("/orders", token)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        JSONArray orders = JSONObject.parseObject(result.getResponse().getContentAsString(StandardCharsets.UTF_8)).getJSONArray("data");
        for (int i = 0; i < orders.size(); i++) {
            JSONObject o = orders.getJSONObject(i);
            if (orderNo.equals(o.getString("orderNo"))) {
                return o;
            }
        }
        return null;
    }
}
