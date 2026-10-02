#!/usr/bin/env python3
# tmp: 在 StorefrontPromoTest 里插一条临时诊断用例,看匿名 /checkout/promo 的真实响应
import re
p = "src/test/java/com/project/platform/controller/StorefrontPromoTest.java"
s = open(p, encoding="utf-8").read()
marker = "    /**\n     * 替 user 1 **领取**目标券"
diag = '''    @Test
    @DisplayName("TMP-DIAG:匿名 /checkout/promo 的真实响应(用完即删)")
    void tmpDiagAnonymous() throws Exception {
        org.springframework.test.web.servlet.MvcResult r =
                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .post("/checkout/promo")
                                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                                .content("{\\"code\\":\\"WELCOME10\\",\\"subtotal\\":\\"198\\"}"))
                        .andReturn();
        System.out.println("TMPDIAG_STATUS=" + r.getResponse().getStatus());
        System.out.println("TMPDIAG_BODY=" + r.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        org.springframework.test.web.servlet.MvcResult r2 =
                mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .get("/orders"))
                        .andReturn();
        System.out.println("TMPDIAG_ORDERS_STATUS=" + r2.getResponse().getStatus());
        System.out.println("TMPDIAG_ORDERS_BODY=" + r2.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

'''
assert marker in s, "marker not found"
s = s.replace(marker, diag + marker, 1)
open(p, "w", encoding="utf-8").write(s)
print("inserted diagnostic test")
