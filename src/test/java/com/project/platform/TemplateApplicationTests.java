package com.project.platform;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 上下文加载冒烟测试:唯一目的是「Spring 上下文能起来」。
 *
 * <p><b>2026-09-24 两处修正</b>:
 * <ol>
 *   <li>此前它只有 {@code @SpringBootTest}、**没有 {@code @ActiveProfiles}**,于是跑在**默认的
 *       dev profile** 上 —— 这个"单测"其实在连**真实的 MySQL 开发库**,只因它不写数据而一直没被发现。
 *       给配置加上"必填环境变量"后它立刻失败,正好把这个隐性依赖暴露出来。</li>
 *   <li>补上 {@code test} profile 后又暴露出第二层问题:{@code schema-h2.sql} 的种子数据**不幂等**
 *       (纯 INSERT,无 MERGE/DELETE 守卫),而注解与其它测试不同会产生**第二个 Spring 上下文**,
 *       种子二次执行 → 主键冲突。故这里**刻意与 {@code BaseControllerTest} 保持完全相同的注解**,
 *       复用同一个上下文(与 {@code OrderCancelConcurrencyTest} 同一做法)。</li>
 * </ol>
 *
 * <p>方法体保持为空是有意的:要断言的就是「上下文能加载」本身,加载失败即测试失败。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TemplateApplicationTests {

    @Test
    public void contextLoads() {
    }

}
