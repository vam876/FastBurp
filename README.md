# FastBurp - 新一代HTTP请求分析工具

🚀 **FastBurp** 是一款基于浏览器扩展的轻量级HTTP/HTTPS请求拦截、重放、分析和AI辅助安全分析浏览器插件，无需安装额外软件，即开即用。

![version](https://img.shields.io/badge/version-1.1.5-blue)
![chrome](https://img.shields.io/badge/Chrome-支持-green)
![edge](https://img.shields.io/badge/Edge-支持-green)
![360](https://img.shields.io/badge/360极速-支持-green)
![QQ](https://img.shields.io/badge/QQ浏览器-支持-green)

- **最新版本**: 1.1.6
- **更新日期**: 2025/10/7
- **下载地址**: https://github.com/vam876/FastBurp/releases/tag/v1.1.6
## ✨ 核心功能

### 🛡️ 无证书HTTPS抓包
- 直接调用Chrome浏览器原生API进行HTTPS流量抓取
- 无需安装证书，避免证书配置的复杂性
- 支持所有基于Chromium的浏览器
<img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/2cbc281c-fd79-48b1-ad1e-facc65db4ec6" />


### 🔍 智能搜索与高亮
- 支持正则表达式搜索响应内容
- 实时高亮显示匹配结果
- 支持大文本优化搜索，性能卓越
<img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/fb1f4d63-282d-453a-bb2f-87f1f6c64b15" />

### 🤖 AI智能分析
- 将HTTP请求和响应发送给AI进行安全分析
- 基于提示工程的定制化分析
- 自由接入各种AI API（OpenAI、DeepSekk、Ollama等）
- 支持自定义提示词模板
- 配置文件导入导出功能
<img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/1ad5fa22-5f8f-4414-bd34-9a6b20cdd309" />

### 🎯 双模式运行
- **拦截模式**：暂停所有请求，允许修改后放行
- **代理模式**：不拦截请求，仅记录流量供分析
  <img width="800" height="600" alt="image" src="https://github.com/user-attachments/assets/cafa12e5-addd-4322-bff1-0c31f02104f9" />

### ⚡ 轻量级设计
- 内存占用极低，不影响浏览器性能
- 即开即用，无需复杂配置
- 极速分析HTTP请求，响应迅速

### 🖥️ 独立窗口支持
- 支持在独立窗口中运行，方便多屏操作
- 窗口大小可调，适配不同使用场景

### 🌐 广泛兼容
- Chrome、Edge、360极速、QQ浏览器、搜狗浏览器
- 所有基于Chromium内核的浏览器

## 🚀 快速开始

### 安装方式


1. **手动安装开发版本**
   ```bash
   # 克隆项目
   git clone https://github.com/vam876/FastBurp.git
   cd FastBurp
   
   
   # 在Chrome中加载未打包的扩展程序
   # 打开 chrome://extensions/
   # 启用"开发者模式"
   # 点击"加载已解压的扩展程序"
   # 选择 FastBurp 文件夹
   ```

### 基本使用

1. **启用拦截**
   - 点击扩展图标打开界面
   - 选择"拦截模式"或"代理模式"
   - 切换开关启用功能

2. **分析请求**
   - 访问任意网站触发HTTP请求
   - 在扩展界面查看捕获的请求
   - 点击请求查看详细信息

3. **AI分析**
   - 选择要分析的请求
   - 点击"AI分析"按钮
   - 选择合适的分析模板开始分析

## 📖 详细功能

### HTTP请求拦截
- 实时捕获所有HTTP/HTTPS请求
- 支持修改请求头、请求体
- 支持请求重放功能
- 智能过滤和分类

### 性能优化
- 分块搜索算法，支持大响应体搜索
- 内存优化，避免界面卡顿
- 异步处理，不影响正常浏览

## 🛠️ 开发技术栈

- **框架**: React 18 + TypeScript
- **UI组件**: Radix UI
- **样式**: TailwindCSS + CSS Modules
- **状态管理**: React Hooks
- **网络**: Chrome Extension APIs


## 📞 联系我们

- GitHub Issues: [提交问题](https://github.com/vam876/FastBurp/issues)
- 作者: [@vam876](https://github.com/vam876)

---

⭐ 如果这个项目对你有帮助，请给我们一个star！
