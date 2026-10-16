# RGB-D 实例分割 Demo

用于课程 RGB-D 小目标实例分割任务的交互式演示系统。输入配准的 RGB 与深度图，展示基线模型、改进模型的实例分割结果，并支持 GT 对照、同步缩放、置信度筛选和图片导出。

技术栈：React 19、TypeScript、Vite；Python 用于准备演示数据。

## 开发状态

- **已完成**：文件校验、深度预览、样例填入、结果对比与导出，以及统一输入输出接口。
- **当前启用**：`MockBackendAdapter`，在浏览器内读取固定测试结果，无需 GPU 或推理服务。
- **尚未实现**：真实后端适配器、模型服务通信与 AI 推理接入。服务位置和调用协议待与算法组确认。

当前预测由课程标注生成，版本和耗时均为测试值，不用于算法评测。Mock 只支持准备好的 6 组原始文件；其他合规输入可以通过校验，但无法取得预测。后端实现信息不进入页面或公共响应。

## 快速开始

环境要求：Node.js 22+、Python 3.10+。课程数据需单独获取，默认目录结构：

```text
workspace/
├── blender/
│   ├── rgb/
│   ├── depth/
│   └── annotations/
└── rgbd/                 # 本仓库
```

在仓库根目录执行以下 PowerShell 命令。Python 依赖建议安装在虚拟环境中。

```powershell
npm ci
python -m pip install -r scripts/requirements.txt
python scripts/prepare_samples.py --dataset ../blender
npm run dev -- --port 5174 --strictPort
```

访问 [http://127.0.0.1:5174/](http://127.0.0.1:5174/)。数据位于其他位置时，修改 `--dataset` 参数。

准备脚本从验证集选取 6 组样例，生成原始图像、GT 和测试预测至 `public/demo-data/`。该目录已被 Git 忽略；首次运行及样例格式变更后需重新生成。

## 输入输出

### 输入规范

| 数据 | 格式 |
| --- | --- |
| RGB | 1024×1024，8 位三通道 PNG |
| 深度 | 1024×1024，16 位单通道 PNG，与 RGB 配准 |
| 深度数值 | 相机 Z 轴距离；原始值 × 0.0001 = 米，0 为无效值 |
| 文件大小 | 每个文件不超过 30 MB |
| GT | 可选；内置样例提供，手动选文件不附带 GT |

校验包括文件格式、解码、尺寸和有效深度。配对关系及配准由输入提供方保证。

### 后端接口

类型定义见 [`src/domain/types.ts`](src/domain/types.ts)，输入约束见 [`src/domain/inputSpec.ts`](src/domain/inputSpec.ts)。

```ts
type InferenceInput = {
  id: string;
  rgb: Blob;
  depth: Blob;
};

interface DemoBackend {
  compare(input: InferenceInput, signal?: AbortSignal): Promise<Comparison>;
}
```

`Comparison` 返回输入 ID 和 `baseline`、`improved` 两个模型的结果。每个结果包含模型名称、版本、耗时及成功/失败状态；成功时返回实例类别、置信度和原图坐标下的二值掩码。支持空预测和单模型失败。

GT 与预览保存在页面数据 `DemoItem` 中，不传入后端。更换输入会取消旧请求、清除旧结果；更换样例中的任一文件也会清除 GT。

## 项目结构

```text
src/
├── application/     # 输入状态、请求生命周期、结果校验
├── backend/         # 后端适配器与装配入口
├── components/      # 输入区、结果对比组件
├── domain/          # 共享类型与输入约束
├── input/           # 原始数据读取、深度解码与预览
├── providers/       # 内置样例读取与资源解码
├── upload/          # 文件校验
└── viewer/          # 掩码绘制、视图变换、图片导出
scripts/             # Python 数据准备脚本
```

数据流：`选择文件 / 样例填入 → 输入准备 → DemoBackend.compare → 结果校验 → 对比视图`。

前端依赖 `DemoBackend` 接口。启动入口通过 [`src/backend/index.ts`](src/backend/index.ts) 的 `createBackend()` 注入实现，目前硬编码为 `MockBackendAdapter`。Mock 在逻辑上属于后端适配层，当前没有独立运行的业务服务器。

## 接入真实推理

1. 确认算法组提供的推理入口、两个模型的版本、RGB-D 预处理和计时范围。
2. 在 `src/backend/` 实现 `DemoBackend`，负责传输原始文件、调用服务及转换响应。具体 HTTP 协议尚未定义。
3. 返回与输入 ID 对应的结果，掩码恢复至 1024×1024 原图坐标；处理取消请求、服务错误和单模型失败。
4. 修改 `createBackend()` 的实例构造，替换 Mock。输入区、对比视图和导出模块继续使用同一接口。
5. 使用课程样例和手动上传验证掩码对齐、结果一致性及现场设备连通性。

模型训练与推理算法由算法组提供。真实服务失败时不回退到 Mock。

## 开发与验证

| 命令 | 用途 |
| --- | --- |
| `npm run check` | TypeScript 检查 |
| `npm test` | 接口、输入校验、深度精度和视图逻辑测试 |
| `npm run build` | 类型检查与生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm run format` | 格式化源码与配置 |

Mock 按 RGB 和原始深度的文件 SHA-256 匹配测试结果。重命名不影响匹配，重新编码会改变摘要。可使用以下文件验证手动选择与第一个样例结果一致：

```text
../blender/rgb/val/0201960_v000.png
../blender/depth/val/0201960_v000.png
```

`MockBackendAdapter` 的 `failOnce` 构造参数用于测试失败重试。测试预测、摘要索引及失败模拟均为适配器内部实现，不属于公共接口。

`dist/` 包含网页与已生成的样例，不包含模型。原始数据、生成资源、依赖和构建产物不提交到 Git。
