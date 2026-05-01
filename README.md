# 电子档案归档章印制工具

一个基于 Tauri v2 + React/TypeScript 的桌面应用，用于为 PDF 文件批量加盖电子归档章。

## 功能特性

- ✅ **PDF 归档章加盖**：支持为 PDF 文件加盖自定义归档章
- ✅ **页码功能**：自动添加页码到 PDF 文件
- ✅ **模板管理**：支持创建和管理多个归档章模板
- ✅ **印章管理**：上传和管理电子印章图片
- ✅ **预览功能**：盖章前预览效果（PDF → PNG）
- ✅ **批量处理**：支持并发控制、错误重试、断点续处理
- ✅ **跨平台**：基于 Tauri，支持 Windows、macOS、Linux

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 5
- Tauri v2 API

### 后端
- Rust + Tauri v2
- Python 3.12+ (PDF 处理引擎)
  - reportlab (PDF 生成)
  - pypdf (PDF 合并)
  - PyMuPDF (PDF 渲染)
  - Pillow (图片处理)

### 数据库
- SQLite (sqlx)

## 安装依赖

### 系统要求
- Node.js 18+
- Rust (stable-x86_64-pc-windows-msvc)
- Python 3.12+
- cargo (Rust 包管理器)

### 前端依赖
```bash
cd D:\workspace\GDZ_gj
npm install
```

### Python 依赖
```bash
pip install reportlab pypdf pymupdf Pillow
```

### Rust 依赖
```bash
cd D:\workspace\GDZ_gj\src-tauri
cargo build
```

## 开发模式运行

```bash
cd D:\workspace\GDZ_gj
npm run tauri dev
```

## 打包发布

### 使用脚本打包 (推荐)
```bash
cd D:\workspace\GDZ_gj
bash scripts/tauri_build.sh build
```

### 手动打包
```bash
cd D:\workspace\GDZ_gj
npm run build
npx tauri build
```

### 打包输出
- **NSIS 安装包**：`src-tauri/target/release/bundle/nsis/GDZ-gj_0.1.0_x64-setup.exe`
- **MSI 安装包**：`src-tauri/target/release/bundle/msi/GDZ-gj_0.1.0_x64_en-US.msi`

## 使用说明

### 1. 创建归档章模板
归档章是符合 DA/T 22-2015 规范的标准档案标识，包含全宗号、年度、档案门类等核心信息。

**操作步骤：**
1. 打开应用，进入"模板管理"
2. 点击"新建模板"
3. 设置归档章内容（全宗号、目录号、档案馆代号等）
4. 设置归档章位置和大小
5. 保存模板

**提示：** 应用内置了符合国标的默认模板，可直接使用或修改。

### 2. 上传印章 (可选)
如果需要同时使用实物印章图片，可以上传印章文件。

**操作步骤：**
1. 进入"印章管理"
2. 点击"上传印章"
3. 选择印章图片（PNG/JPG）
4. 预览并确认印章效果
5. 保存印章

**注意：** 此功能为可选功能，仅使用归档章时无需上传印章。

### 3. 加盖归档章
为单个 PDF 文件加盖归档章。

**操作步骤：**
1. 选择要盖章的 PDF 文件
2. 选择归档章模板
3. 点击"开始盖章"
4. 查看输出文件（原目录/_stamped/）

**输出位置：** 默认在原文件同目录下创建 `_stamped/` 文件夹，盖章后的文件保存在此处。

### 4. 批量处理
同时为多个 PDF 文件加盖归档章，大幅提升工作效率。

**操作步骤：**
1. 选择多个 PDF 文件
2. 选择归档章模板
3. 设置并发数（默认 4）
4. 点击"开始批量处理"
5. 查看处理进度和结果报告

**性能建议：**
- 并发数设置过高可能导致内存不足
- 建议根据电脑配置调整（4-8 核 CPU 推荐并发数 4-6）
- 处理完成后会生成处理报告。

## 项目结构

```
GDZ_gj/
├── src/                    # 前端 React 代码
│   ├── components/         # React 组件
│   │   ├── TemplateManager.tsx
│   │   ├── SealManager.tsx
│   │   └── ...
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/             # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── core/          # 核心功能模块
│   │   │   ├── pdf_editor.rs   # PDF 盖章引擎接口
│   │   │   ├── processor.rs    # 批量处理
│   │   │   └── ...
│   │   ├── models/        # 数据模型
│   │   ├── db.rs          # 数据库操作
│   │   └── lib.rs        # Tauri 命令注册
│   ├── Cargo.toml
│   └── tauri.conf.json
├── resources/             # Python 脚本和资源
│   ├── stamp_pdf.py       # PDF 盖章引擎 (Python)
│   └── dist/             # PyInstaller 打包输出
│       └── stamp_pdf.exe  # 独立可执行文件
├── scripts/               # 构建脚本
│   ├── find_cargo.sh      # 自动查找 cargo
│   └── tauri_build.sh    # Tauri 打包脚本
├── dist/                  # 前端构建输出
├── package.json
├── vite.config.ts
└── README.md
```

## 技术亮点

### 1. Python 脚本打包
使用 PyInstaller 将 `stamp_pdf.py` 打包成独立可执行文件 (`stamp_pdf.exe`)，用户无需安装 Python 环境。

### 2. 智能可执行文件查找
Rust 后端智能查找盖章可执行文件：
1. 首先查找 `stamp_pdf.exe` (打包模式)
2. 如果不存在，查找 `stamp_pdf.py` (开发模式)

### 3. 并发控制 + 错误重试
批量处理时使用 `tokio::sync::Semaphore` 控制并发数（默认 4），单个文件失败重试 2 次。

### 4. 断点续处理
如果输出文件已存在，直接跳过处理，支持断点续传。

### 5. 自动查找 Rust 工具链
`find_cargo.sh` 脚本自动查找 cargo 路径，避免每次手动设置环境变量。

## Git 提交历史

```bash
a36d80f feat(P8): 批量处理优化（并发控制 + 错误重试）
924d8eb feat: 添加 tauri_build.sh 构建打包脚本
26c1809 feat: 添加 find_cargo.sh 脚本，自动查找并运行 cargo 命令
ff9b01f fix: 修复 Rust 编译错误，cargo check 通过
944bbe9 feat(P7): 印章管理前端 UI 实现
2b07de3 feat(P7): 印章管理功能实现
b8a455b feat(P6): PDF 预览功能实现
d58c4b9 feat(P4+P5): PDF盖章核心实现 + 页码功能
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**开发日志**：
- P0: Tauri v2 项目初始化 ✅
- P1: SQLite 数据库设计与初始化 ✅
- P2: 后端 Rust 核心服务 ✅
- P3: 前端 React/TypeScript UI 开发 ✅
- P4: 档案类型模板系统 ✅
- P5: 页码功能完善 ✅
- P6: 预览功能（PDF→PNG）✅
- P7: 印章管理功能 ✅
- P8: 批量处理优化 ✅
- P9: 打包与发布 ✅
