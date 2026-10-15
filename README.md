# RGB-D 实例分割 Demo

中文单页实验台，用于展示课程 RGB-D 输入、真实实例标注，以及基线与改进模型的对比。
当前是 **Mock 模式**：输入与 GT 真实，预测由 GT 的固定删减和形态扰动生成，不代表模型性能；耗时为模拟值。

## 本地启动

要求 Node.js 22+、Python 3.10+。从本仓库目录运行：

```powershell
npm ci
python -m pip install -r scripts/requirements.txt
python scripts/prepare_samples.py --dataset ../blender
npm run dev
```

打开终端打印的本地地址，默认是 `http://127.0.0.1:5173`。缺少样例时页面会提示生成资源。
生成的 `public/demo-data/` 已 ignore，不提交数据集或生成图片。脚本不会修改数据源；重复执行会覆盖所选样例的生成文件，不删除其他目录。

```powershell
npm run check
npm test
npm run build
npm run preview
```

构建输出 `dist/` 包含生成的样例资源，可在无模型环境下演示；不要将其提交到 Git。分享数据或构建产物时沿用课程数据许可。

## 操作

1. 选择内置验证集样例，展开输入区查看 RGB 和深度预览。
2. 点击“运行对比”，查看真实 GT 与两组模拟预测。
3. 在任一结果上滚轮缩放、拖动平移，三列同步；工具栏可复位、过滤置信度、调整透明度。聚焦画布后也可使用加减键缩放，`0` 复位。
4. 导出当前视图的对比 PNG，图片保留模拟标记。颜色仅区分实例，不代表跨模型匹配。
5. 上传区仅本地校验 RGB / 深度 PNG 并预览 RGB，不发送文件、不返回模拟推理结果。输入应为 1024×1024，RGB 为 8 位三通道，深度为 16 位单通道，每文件不超过 30 MB。

模拟失败重试：将 `.env.example` 复制为 `.env.local`，设置 `VITE_MOCK_FAIL_ONCE=true` 并重启开发服务。每次页面刷新后首次对比会失败，重试恢复。

## 架构与接入边界

```text
React 页面 / 对比画布 / 导出
             ↓
useDemo：输入、请求取消、运行状态、过期结果保护
             ↓
DemoProvider（统一数据契约）
       ↙                     ↘
MockProvider              HttpProvider（未来）
       ↓                     ↓
本地 fixtures             Demo Server → AI 模型推理
```

- `src/domain/types.ts`：输入、实例掩码、结果来源、模型状态与 Provider 接口。
- `src/providers/`：唯一数据访问层；Mock 读取同源资源并解码为单通道二值掩码。页面不解析 COCO RLE、不直接请求 API。
- `src/application/`：请求状态、取消和结果所属输入校验；切换输入清除旧结果。
- `src/viewer/`：独立渲染、过滤、视图变换与导出；不依赖模型框架。
- `scripts/prepare_samples.py`：离线数据准备，选取验证集同型/混合零件各低、中、高密度场景，共 6 个样例。按图像自身有效深度范围生成伪彩色；原始深度单位由标注元数据读取。

目前不实现业务服务器、模型加载、真实上传推理和 HTTP 协议。接入时新增实现 `DemoProvider` 的 HTTP Adapter，通过工厂选择；由 Adapter 将服务掩码转换为 `Mask`，页面保持不变。服务自行承担原始深度预处理与推理。单模型失败由 `ModelResult.status = 'error'` 展示。`getCapabilities()` 声明上传推理能力；接入上传推理时应用流程再将已校验文件交给 Provider。

未来 Server 可以与 AI 模块在同一 Python 进程中运行，Web 无需知道模型部署位置。服务失败不得自动返回 mock 结果。真实缓存与实时结果分别标记 `cached`、`live`；mock 永远标记 `mock`。

完整实验指标暂显示“待提供”，与单次预测、展示阈值独立。经核验后应注明实验版本、硬件、输入尺寸及计时条件，再单独增加结果数据源。

## 仓库约定

仅跟踪源码、配置、锁文件和必要使用说明。依赖、构建输出、样例资源、本地环境配置、Python 缓存均已 ignore；数据、设计稿、对话记录和临时检查产物放仓库外。
