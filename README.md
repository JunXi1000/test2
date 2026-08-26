# 在线商店 (前后端分离)

这是一个基于 Java (Spring Boot) 和 Vue 3 的前后端分离电商项目。它提供了一套完整的电商核心功能，包括用户、商品、订单、购物车、店铺、地址管理等，并集成了后台管理系统。

## ✨ 项目特色

- **前后端分离**：后端专注业务逻辑与 API，前端负责用户交互与视图渲染，分工明确，易于维护。
- **技术栈主流**：采用 Spring Boot 3、MyBatis、Vue 3、Vite、Element Plus 等业界流行技术，学习价值高。
- **功能模块完整**：覆盖电商核心业务流程，从用户注册登录到商品浏览、下单支付、后台管理，一应俱全。
- **代码结构清晰**：遵循标准 Maven 和 Vue 项目结构，代码分层合理，易于二次开发。

## 🛠️ 技术栈

### 后端 (`src/main/java`)

- **核心框架**: Spring Boot 3.2.10
- **持久层**: MyBatis 3.0.4
- **数据库**: MySQL 8.0
- **安全与认证**: JWT (JSON Web Token)
- **构建工具**: Maven
- **开发语言**: Java 17
- **其他**: Lombok, Fastjson2, Hutool

### 前端 (`web/`)

- **核心框架**: Vue 3.4
- **路由**: Vue Router 4
- **状态管理**: Pinia
- **UI 组件库**: Element Plus
- **构建工具**: Vite 5
- **HTTP 请求**: Axios
- **图表**: Echarts
- **其他**: Swiper, Day.js, Lodash

## 📂 目录结构

```
.
├── sql/                      # 数据库脚本
│   ├── chat.sql              # 聊天表
│   └── migration-2026-08-08-phase1.sql  # 一期增量迁移（对运行中库补表）
├── src/                      # 后端 Java 源码（Spring Boot）
│   └── main/java/com/project/platform/  # 33 个 Controller + service/mapper/entity
├── uploads/                  # 上传文件（运行时数据，git 忽略）
├── web/                      # 前端 Vue 源码
│   ├── src/                  # 页面 / api / stores / router
│   ├── .env*                 # 环境变量（VITE_API_BASE_URL / VITE_USE_MOCK）
│   ├── vite.config.ts        # 开发代理 /api → :1000
│   └── package.json
├── docs/                     # 项目文档（8 份）
│   ├── REQUIREMENTS.md       # 电商系统需求分析文档（百万级用户目标，含用例/时序图）
│   ├── REQUIREMENTS-GAP.md   # 现有实现 vs 需求差距分析
│   ├── ARCHITECTURE.md       # 系统架构（分层/认证）
│   ├── MODULES.md            # 功能模块与实现状态矩阵（真实/部分/占位）
│   ├── DEVELOPMENT.md        # 开发指南与代码规范
│   ├── backend-api.md        # 后端接口契约清单（端点×实现状态）
│   ├── ROADMAP.md            # 开发路线图（Phase 1 已完成，Phase 2–4）
│   └── API接口说明.md        # 前端期望的 HTTP 接口汇总（与 web/src/api 对齐）
├── pom.xml                   # 后端 Maven 依赖
└── README.md                 # 项目说明
```

> 📖 **文档索引**：新开发者从 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) 起步（环境/启动/mock 机制），读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 了解架构，用 [docs/MODULES.md](docs/MODULES.md) 看功能实现状态，按 [docs/ROADMAP.md](docs/ROADMAP.md) 推进开发。

## 🚀 本地开发（需自行安装环境）

### 环境准备

在启动项目前，请确保你的开发环境中已安装以下软件：

- **JDK**: 17 或更高版本
- **Maven**: 3.6 或更高版本
- **Node.js**: 16.x 或更高版本
- **MySQL**: 8.0 或更高版本
- **IDE**: IntelliJ IDEA, VS Code (推荐)

## 🏁 快速开始

### 1. 数据库配置

1.  启动你的 MySQL 数据库服务。
2.  创建一个新的数据库，例如 `template_v3`。
3.  将项目根目录下的 `sql/schema.sql` 文件导入到你创建的数据库中，以初始化表结构和基础数据（admin 种子账号已包含其中）。
4.  打开后端配置文件 `src/main/resources/application.yaml`，根据你的本地环境修改数据库连接信息：

    ```yaml
    spring:
      datasource:
        url: jdbc:mysql://localhost:3306/template_v3?useUnicode=true&useSSL=false&characterEncoding=utf8&serverTimezone=Asia/Shanghai
        username: your_mysql_username  # 替换为你的 MySQL 用户名
        password: your_mysql_password  # 替换为你的 MySQL 密码
    ```

### 2. 启动后端服务

1.  使用 IntelliJ IDEA 打开项目根目录。
2.  等待 Maven 自动下载所有依赖。
3.  找到启动类 `src/main/java/com/project/platform/ProjectManagement.java`。
4.  右键点击并选择 `Run 'ProjectManagement.main()'`。
5.  如果控制台输出 `Tomcat started on port(s): 1000 (http)`，则表示后端服务启动成功。

### 3. 启动前端服务

1.  在 VS Code 中打开 `web/` 目录，或在终端中进入该目录。
2.  安装项目依赖：

    ```bash
    npm install
    ```

3.  启动开发服务器：

    ```bash
    npm run dev
    ```

4.  前端服务默认会运行在 `http://localhost:5173` (具体端口以终端输出为准)。
5.  打开浏览器访问该地址，即可看到项目登录页面。

---

现在，你可以开始探索这个电商项目了！祝你编码愉快！
