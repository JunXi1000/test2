package com.project.platform.controller;

import com.alibaba.fastjson2.JSONObject;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AddressControllerTest extends BaseControllerTest {

    @Test
    @DisplayName("GET /addresses — should return addresses")
    void listAddresses() throws Exception {
        get("/addresses", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("POST /addresses — should create address")
    void createAddress() throws Exception {
        post("/addresses", userToken(), Map.of(
                "name", "Office",
                "tel", "123456789",
                "address", "456 Work St",
                "userId", 1
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("PUT /addresses/1 — should update address")
    void updateAddress() throws Exception {
        put("/addresses/1", userToken(), Map.of(
                "name", "Updated Home",
                "tel", "99999999",
                "address", "789 New St"
        )).andExpect(status().isOk())
          .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("PUT /addresses/1/default — C5 诚实降级:501(此前 no-op 却返 200 假成功)")
    void setDefaultIsNotImplemented() throws Exception {
        // TASK-002 契约 C5:shipping_address 表没有 is_default 列,该端点此前
        // 收下请求、什么都不做、返回 200 —— 用户点「设为默认」以为成功了。
        // 现在改为 501 + 明确 msg;真正实现要等 schema(V10) 与 Service 同批交付。
        String before = bodyOf(get("/addresses", userToken())
                .andExpect(status().isOk()).andReturn());

        put("/addresses/1/default", userToken(), Map.of())
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.code").value(501));

        // 诚实降级的另一面:不得有任何写入痕迹(地址列表在调用前后逐字一致)
        String after = bodyOf(get("/addresses", userToken())
                .andExpect(status().isOk()).andReturn());
        assertEquals(before, after, "501 之后地址列表必须逐字不变(is_default 列尚未落地)");
    }

    @Test
    @DisplayName("DELETE /addresses/1 — should delete address")
    void deleteAddress() throws Exception {
        delete("/addresses/1", userToken())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("user2 修改 user1 的地址应 403(横向越权)")
    void user2CannotModifyUser1Address() throws Exception {
        put("/addresses/1", user2Token(), Map.of(
                "name", "Hacked",
                "tel", "000",
                "address", "Evil St"
        )).andExpect(status().isForbidden());
    }

    /** 取响应体并规范化成可比较的字符串 */
    private String bodyOf(MvcResult result) throws Exception {
        JSONObject body = JSONObject.parseObject(
                result.getResponse().getContentAsString(StandardCharsets.UTF_8));
        return body == null ? "" : body.toJSONString();
    }
}
