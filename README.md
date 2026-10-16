# RGB-D 实例分割 Demo

中文单页演示系统。内置样例与外部上传共用一条流程：准备 RGB-D → 运行对比 → 展示基线与改进结果；有真实标注时附带 GT。
当前注入开发用 `MockAdapter`，预测为固定模拟数据，不代表模型性能，耗时也为模拟值。最终接入真实适配器后不保留 mock 专属操作。

## 本地启动

要求 Node.js 22+、Python 3.10+。从本仓库目录运行：

```powershell
npm ci
python -m pip install -r scripts/requirements.txt
python scripts/prepare_samples.py --dataset ../blender
npm run dev
```

旧版生成样例没有原始深度与文件摘要，升级后必须重新运行准备脚本。
打开终端打印的本地地址。若需要沿用 5174：

```powershell
npm run dev -- --port 5174 --strictPort
```

`public/demo-data/` 已 ignore；脚本不修改源数据，重复执行覆盖所选样例资源，不删除其他目录。

```powershell
npm run check
npm test
npm run build
npm run preview
```

构建输出 `dist/` 包含生成样例，可离线部署网页；它不包含模型。分享数据或构建产物时沿用课程数据许可。

## 输入输出约定

输入遵循课程一条数据的格式，不支持其他深度编码：

| 项目 | 约定 |
| --- | --- |
| RGB | 1024×1024，8 位三通道 PNG |
| 深度 | 1024×1024，16 位单通道原始 PNG，与 RGB 配准 |
| 深度语义 | 相机 Z 轴距离，整数值乘 0.0001 得到米，0 表示无效 |
| 文件大小 | 每个文件最大 30 MB |
| GT | 可选，独立用于展示，不进入推理 |

格式与解码检查不能证明两张图片属于同一场景或已配准，上传者应提供符合课程约定的配对文件。全无效深度会被拒绝。
输入常量集中于 `src/domain/inputSpec.ts`。浏览器以 16 位整数解码深度并生成伪彩色预览；预览不替代原始推理文件，也不修改原文件。

共享类型位于 `src/domain/types.ts`：

```ts
type InferenceInput = { id: string; rgb: Blob; depth: Blob };

interface InferenceAdapter {
  readonly info: { source: 'mock' | 'cached' | 'live'; label: string; description?: string };
  compare(input: InferenceInput, signal?: AbortSignal): Promise<Comparison>;
}
```

`id` 只用于将结果关联到当前输入，不用于推理内容匹配；`File` 是 `Blob`，上传文件和内置资源使用同一接口。
`DemoItem` 单独保存输入、RGB 预览、深度预览和可选 GT。适配器只能收到 `item.input`，不会收到 GT 或预览。

输出 `Comparison` 包含 `inputId` 和两个模型结果，角色分别为 `baseline`、`improved`。每个模型包含名称、版本、结果来源、耗时和成功/失败状态；成功时每个预测实例必须具有类别、置信度和原图坐标下的 1024×1024 二值掩码，允许空实例列表。GT 类型不具有置信度。
应用层检查输入 ID、模型角色、预测置信度及掩码尺寸；支持单模型失败，另一模型仍能展示。

## 操作与开发验收

1. 选择样例，展开 RGB 与深度预览，点击“运行对比”。
2. 或上传配对 RGB、深度文件；两者校验和输入准备完成后，使用同一个“运行对比”。上传不携带 GT，因此展示两列预测。
3. 在任一结果上缩放、平移，视图同步。工具栏支持掩码显隐、透明度和置信度过滤；GT 不受阈值影响。画布聚焦后加减键缩放，`0` 复位。
4. 导出当前对比视图，保留预测来源标记。颜色只区分实例，不表示跨模型匹配。
5. 更换任一文件或切换输入后，旧结果清除、旧请求取消；新输入未就绪时不可运行。

开发适配器按照 **两个原始文件的 SHA-256 内容摘要**匹配 `mock-index.json`，不依赖文件名、样例 ID 或 GT。上传与内置样例完全相同的原始文件会得到相同预测；重命名不影响匹配，但重新编码 PNG 后字节改变会视为不同输入。
没有匹配项时返回明确错误，不复用其他图像的结果，也不自动生成随机掩码。这个匹配规则仅属于开发适配器，不是正式系统的输入限制。

用于测试上传的同一组文件：

```text
../blender/rgb/val/0201960_v000.png
../blender/depth/val/0201960_v000.png
```

它们对应第一个内置样例。上传两者后的预测应相同，且不展示 GT。也可混用不同样例的 RGB/深度，验证开发适配器明确拒绝匹配（这不是自动配准校验）。
模拟失败重试：复制 `.env.example` 为 `.env.local`，设置 `VITE_MOCK_FAIL_ONCE=true` 并重启开发服务。首次对比失败，重试恢复。

## 架构与真实推理接入

```text
StaticSampleRepository ── 读取课程样例和可选 GT ┐
                                              ├→ prepareInput → DemoItem
UploadPanel ───────────── 校验上传文件          ┘
                                                        ↓
                                              useDemo：统一运行流程
                                                        ↓
                                      InferenceAdapter.compare(item.input)
                                              ↙                   ↘
                                       MockAdapter             真实 Adapter（后续）
                                              ↓                   ↓
                                       固定测试结果          Demo Server → AI 推理
                                              ↘                   ↙
                                              统一结果 → 对比 / 导出
```

- 样例读取与模型调用独立。准备脚本输出 RGB、原始深度、GT；模拟预测另存 `mock.json`，摘要索引另存 `mock-index.json`。
- `src/input/` 负责统一输入准备、深度预览及文件摘要；`src/application/` 管理请求、取消、过期结果保护和输出校验。
- `src/providers/` 的样例仓库只读取样例，推理适配器只处理原始 RGB-D；渲染层不解析模型返回格式。
- 接真实服务时新增 `InferenceAdapter` 实现，在工厂中选择；由该适配器传输两个原始文件，并把服务输出转换为统一掩码。服务端负责模型所需预处理，输出回原图坐标。HTTP 协议与模型加载本阶段不实现。
- 页面顶部开发说明由 `adapter.info.source` 驱动；真实适配器不显示 mock 提示。服务失败不得自动返回模拟结果。

完整实验指标收起于页面底部，待真实评测提供，与单张预测和展示阈值独立。

## 仓库约定

仅跟踪源码、配置、锁文件和必要使用说明。依赖、构建输出、生成样例、本地配置、Python 缓存均 ignore；数据、设计稿、对话记录与临时检查产物放仓库外。
