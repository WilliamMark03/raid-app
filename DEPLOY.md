# 微信云托管部署指南

## 前置准备

1. 已注册微信小程序账号（已有 AppID: wx5496de5fd665e7e0）
2. 已开通微信云托管服务

---

## 步骤一：获取 Supabase 环境变量

在 Supabase 项目设置中获取以下信息：

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 进入你的项目 → Settings → API
3. 记录以下值：
   - **Project URL** → 对应 `COZE_SUPABASE_URL`
   - **anon public** → 对应 `COZE_SUPABASE_ANON_KEY`
   - **service_role** → 对应 `COZE_SUPABASE_SERVICE_ROLE_KEY`

---

## 步骤二：开通微信云托管

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「云开发」→「云托管」
3. 如果未开通，点击「开通」
4. 选择「新建服务」

---

## 步骤三：部署后端服务

### 方式A：使用控制台部署（推荐新手）

1. 在云托管控制台，点击「新建服务」
2. 填写服务信息：
   - 服务名称：`raid-registration`
   - 备注：公会打本报名后端
   
3. 选择「镜像上传」方式：
   - 本地构建镜像并推送到微信容器镜像服务
   - 或使用 GitHub 仓库自动构建

4. 配置环境变量：
```
COZE_SUPABASE_URL=你的Supabase_URL
COZE_SUPABASE_ANON_KEY=你的anon_key
COZE_SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
```

5. 配置规格：
   - CPU：0.5核
   - 内存：512MB
   - 最小实例：0（按量付费，无请求时不收费）
   - 最大实例：10

6. 点击「部署」

### 方式B：使用命令行部署

```bash
# 安装微信云托管 CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署
cd server
tcb fn deploy raid-registration --runtime nodejs:20
```

---

## 步骤四：获取服务域名

部署成功后，在云托管控制台可以看到：

- **默认域名**：`xxx.ap-shanghai.run.tcloudbase.com`
- 这个域名无需配置服务器域名白名单，小程序可直接调用

---

## 步骤五：更新前端配置

修改前端代码中的 API 地址为云托管域名。

---

## 费用说明

微信云托管采用**按量付费**：

| 配置 | 费用估算 |
|-----|---------|
| 0.5核 + 512MB | 约 0.05元/小时 |
| 无请求时不收费 | 最小实例设为 0 |

**预估**：小型公会每月费用 < 10元

---

## 常见问题

### Q: 部署失败怎么办？
A: 检查环境变量是否正确配置，查看云托管日志排查问题

### Q: 如何更新代码？
A: 重新构建镜像并部署，或配置 CI/CD 自动部署

### Q: 数据库连接失败？
A: 确认 Supabase 项目状态正常，环境变量配置正确

---

## 下一步

部署成功后，告诉我你的云托管域名，我帮你更新前端配置。
