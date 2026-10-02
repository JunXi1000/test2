# TASK-000-J 测试基础设施修复（Mockito self-attach）

> 执行人：devops ｜ 时间：2026-10-01 20:05–20:08 ｜ 任务来源：总控派发（QA 报告 Blocker）

---

## 1. ⚠️ 最重要的一件事：**故障恢复不是这个修复带来的**

总控要求给出「前后对照数字」。数字如下，但**因果关系与最初的判断不同**，必须先说清楚：

| 阶段 | 命令 | 结果 |
|---|---|---|
| 基线 | `mvn -B clean test`（**无** MockMaker 配置） | `Tests run: 163, Failures: 0, **Errors: 147**, Skipped: 0` |
| 修复后 | `mvn -B clean test`（**有** MockMaker 配置） | `Tests run: 163, **Failures: 1, Errors: 0**, Skipped: 0` |

看起来是「147 → 0」，完美对应总控的预期。**但这是巧合。**

我对基线日志做了针对性检索：

```
grep "MockitoInitializationException|Could not self-attach|byte-buddy-agent"
→ No matches found
```

**基线日志里根本没有 Mockito 的影子。** 147 个 ERROR 的真实根因是另外的东西：

```
Caused by: org.apache.ibatis.builder.BuilderException: Error creating document instance.
  Cause: org.xml.sax.SAXParseException; lineNumber: 151; columnNumber: 40;
  元素内容必须由格式正确的字符数据或标记组成。
```

即 `src/main/resources/mapper/AnalyticsMapper.xml` 第 151 行当时写的是**裸 `<`**
（应为 `&lt;`），XML 解析失败 → `SqlSessionFactory` 建不起来 → **整个 Spring 上下文加载失败**
→ 后续 146 个测试全部以
`ApplicationContext failure threshold (1) exceeded` 连带阵亡。

**所以：**

| 结论 | |
|---|---|
| 147 → 1 的恢复，**归功于** | backend Agent 修正了 `AnalyticsMapper.xml:151` 的裸 `<` |
| Mockito 修复**是否**促成了恢复 | ❌ **未观察到任何因果关系** |
| 这**是否**证明了 `mock-maker-subclass` 有效 | ❌ **不能证明** |

> 🔴 **请勿把「测试网恢复」记在这个修复的功劳上。** 写进 `06-TEST-REPORT.md` 时，
> 真实因果是「共享工作区竞态导致 XML 语法错误」，见 `08-DEVOPS.md §8`。

---

## 2. 为什么这个修复**无法**在我的环境里被验证

总控的诊断（Mockito 5.x 默认 inline maker → 需 self-attach → 受限 runner 失败）本身是成立的，
但在我的环境里它**根本没被触发过**：

- **基线阶段**：Spring 上下文因 XML 语法错误就崩了，`ResetMocksTestExecutionListener`
  根本没走到碰 `MockUtil` 那一步 → 看不到 self-attach 失败
- **修复后阶段**：上下文成功加载，listener 正常执行 → **依然没有任何 Mockito 异常**

即我的 runner 似乎**允许** self-attach（或该路径压根没被走到）。
**我没有第二个受限 runner 可以交叉验证。**

---

## 3. 那这个改动还要不要留？——留，但请知道它当前是**未验证的保险**

### 3.1 已证明「不会改坏测试」

总控要求的前置确认（项目是否用到 inline-only 能力）已完成，结论是**零使用**：

| 检索项 | 命中数 |
|---|---|
| `mockStatic` / `mockConstruction` / `MockedStatic` | **0** |
| `Mockito.` / `@Mock` / `@Spy` / `import org.mockito` | **0** |
| 测试文件总数 | 23 个 |

> **排除工具故障**：我用同一工具、同一路径检索 `SpringBootTest|import org.junit.jupiter.api.Test`
> → **29 处命中**。工具能正常命中，故上面的 0 是真实结果，不是检索失灵。

即：**全项目没有任何一处真的在用 Mockito**（测试全是 `@SpringBootTest` + MockMvc 的集成测试）。
降级到 subclass maker **不会丢失任何现存能力**。

`pom.xml` 里 `mockito-subclass:5.11.0` 本来就已引入（`:36-42`），
subclass maker 的实现在 classpath 上是现成的，**不需要动任何版本号**
（遵守 `DEVELOPMENT.md §4.4`「不要继续调整版本」）。

### 3.2 留它的理由

它是**环境无关**的官方开关：把「能否 self-attach」这个**环境相关**变量，
换成「用哪个 maker」这个**项目内声明**。对总控描述的「容器加固 / CI sandbox」场景，
这正是标准解法。**即使我验证不了，它也不会让现状变差**（因为现状是 0 使用）。

### 3.3 留它的已知代价 —— 请转告后续开发者

一旦有测试**将来**需要 mock `static` 方法、`final` 类或构造器，
subclass maker **做不到**，会以「不支持」报错。
届时的正解是删掉这个文件（或改回 `mock-maker-inline`），**不要**去改测试来迁就它。

---

## 4. 已做的改动

**新增唯一一个文件**（未修改任何既有文件，未动任何版本号）：

```
src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker
内容：mock-maker-subclass
```

> 该目录此前**不存在**（与总控的 glob 结论一致），现在已建立。

---

## 5. 唯一剩余的真实失败（**与 Mockito 无关**，需 QA 处理）

```
Tests run: 163, Failures: 1, Errors: 0, Skipped: 0

MerchantOrderOwnershipTest.shopCanChangeOwnOrderStatus:119
  Status expected:<200> but was:<400>
```

### 定性：**过期测试，不是后端回归**

`MerchantApiController` 新增了状态机前置校验（该文件 `:184-187` 自述是 2026-09-27 的**有意修复**）：

```java
private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "待支付", Set.of("processing", "cancelled"),   // ← 注意：没有 shipped
        "待发货", Set.of("shipped", "cancelled"),
        "待收货", Set.of("delivered", "cancelled"),
        "已完成", Set.of(),
        "已取消", Set.of());                            // MerchantApiController.java:42-47
```

而测试（`MerchantOrderOwnershipTest.java`）：

| 行 | 内容 |
|---|---|
| `:59` | `order.setStatus("待支付")` —— 种子订单是**待支付** |
| `:118` | `put(..., Map.of("status", "shipped"))` —— 却要求**直接跳到** shipped |
| `:119` | `.andExpect(status().isOk())` |

`待支付 → shipped` 越级，按新状态机**应当**被拒（返回 400 是**正确行为**）。
测试写于状态机之前，因此**落后于实现**。

### 建议修法（归 QA，写范围 `src/test`）

把该用例改成**分两步推进**，从而正面钉住新状态机：

```java
Integer orderId = seedOrderOfShop2();                       // 待支付
put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "processing"))
        .andExpect(status().isOk());                        // 待支付 → 待发货
put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
        .andExpect(status().isOk());                        // 待发货 → 待收货
assertEquals("待收货", productOrderMapper.selectById(orderId).getStatus());
```

**外加强烈建议补一条**越级跳转的负向用例（这正是新代码的核心价值，现在无人守护）：

```java
// 待支付 直接跳 shipped → 400，且订单状态不变
put("/merchant/orders/" + orderId + "/status", shop2Token(), Map.of("status", "shipped"))
        .andExpect(status().isBadRequest());
assertEquals("待支付", productOrderMapper.selectById(orderId).getStatus());
```

---

## 6. 授权网与错误模型网 —— **已恢复可用** ✅

这是总控最关心的部分（两套网同时失声导致本轮所有验收失据）。修复后：

| 测试类 | 结果 |
|---|---|
| `AuthorizationBaselineTest` | ✅ **14 / 14 全绿** |
| `ErrorModelTest` | ✅ **19 / 19 全绿** |
| 其余 21 个测试类 | ✅ 全绿（除 §5 那 1 条） |

---

## 7. 复现方式（受限环境下需要额外参数）

```bash
# 1) 复制到独立目录再跑 —— 避开其他 Agent 正在写入的半截文件（08-DEVOPS.md §8）
cp -r src pom.xml /tmp/build/ && cd /tmp/build

# 2) 本会话还需指定可写的本地仓库（用户级 ~/.m2 在沙箱内只读）
mvn -B -Dmaven.repo.local=/tmp/m2repo clean test
```

**正常机器上直接 `mvn -B clean test` 即可**，上面两条是本会话的环境适配。

---

## 8. 给总控的三个明确请求

1. **修正因果记录**：`06-TEST-REPORT.md` 里「测试网恢复」应归因于
   `AnalyticsMapper.xml:151` 竞态修复，**不是**本任务的 Mockito 修复。
2. **请 QA 在受限 runner 上复跑一次**以真正验证 `mock-maker-subclass`。
   我的环境允许 self-attach，**无法验证**。若 QA 那边也验证不了，
   建议把这个文件标注为「未验证的防御性配置」而非「已验证的修复」。
3. **转告 QA** §5 那条过期测试需要修 —— 它现在会**持续**让测试网挂红，
   与环境无关，属于真实待办。