# 小版本发布约定

- main：已测试的小版本发布分支。不要将日常开发提交直接推入 main。
- dev：日常开发和修复分支。vercel.json 已关闭 dev 的自动 Git 部署。
- 当前游戏基线：f9d2ad445192a8881885795ce3497be6eba3487a。此流程配置不改变游戏内容。
- 小版本：一组完整、可试玩的功能或修复，完成测试后统一发布。不是每个 commit 一个版本。

## 发布检查
1. 在 dev 完成当前用户要求的一组改动。
2. 执行 node --check dist/app.js、node --check dist/engine.js、node engine.test.mjs。
3. 对受影响的界面和战斗、成长、存档流程进行试玩验证。
4. 更新版本号与变更记录，再将确定的发布提交推进 main，不强推、不覆盖并发修改。
5. 确认 Vercel 的生产分支为 main，并跟踪对应 Git SHA 的部署达到 READY。
6. 验证已有正式域名指向该版本，报告版本、变更、测试结果与同一个正式试玩链接。失败时不得称已同步。

## 配置边界
- 只关闭 dev 分支自动 Git 部署；其他未指定分支按 Vercel 默认行为，勿随意创建功能分支并推送。
- 手动部署/API 部署不受此 Git 开关约束；只用于明确的小版本发布。
- 当前 Vercel 连接暂时无法读取 game909 项目，生产分支、正式域名和部署权限仍待核验。
- 本约定不修改 Vercel 访问权限、付费计划或安全设置。

官方说明：https://vercel.com/docs/project-configuration/git-configuration
