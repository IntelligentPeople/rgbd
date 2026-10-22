# 部署指南

## 选择部署方式

推荐把网页和推理服务都放在有 NVIDIA GPU 的主机上，笔记本通过浏览器访问。笔记本无需安装 Python、CUDA 或模型。也可把网页单独部署在笔记本或静态服务器上，通过配置连接推理主机。

网页不能直接以 `file://` 打开：构建后的 `dist/` 需要 HTTP 静态服务器，推理服务仍需单独运行。算法组生成的离线 HTML 是另一种交付形式，不能代替本仓库的 API。

## 一、准备目录和依赖

以下以 Windows PowerShell、`D:\rgbd` 为例，路径可自行更换：

```text
D:\rgbd\
├── rgbd\                  本仓库
├── DPSeg\                 算法组源码，与发布权重匹配的版本
└── deployment\            仓库外的运行文件
    ├── .venv\             Python 环境
    ├── weights\           DPSeg 三份发布权重，保留发布文件名
    └── coco\              公开 Mask2Former 初始化模型与配置
```

前端需要 Node.js 22+。推理主机当前要求 NVIDIA CUDA GPU：服务显式使用 `cuda:0`，未提供 CPU 模式。本机已验证 Windows + Python 3.12 + RTX 4070 12 GB；这不是任意设备的最低硬件承诺。

推理环境已验证的关键版本：

| 依赖 | 版本 |
| --- | --- |
| PyTorch / torchvision | 2.7.1+cu126 / 0.22.1+cu126 |
| transformers / safetensors | 4.53.2 / 0.5.3 |
| numpy / Pillow | 2.3.1 / 11.3.0 |
| pycocotools / scipy | 2.0.11 / 1.16.3 |
| matplotlib / huggingface-hub | 3.10.6 / 0.33.4 |

在新机器上创建环境，不要直接复制已有 `.venv`：

```powershell
py -3.12 -m venv D:\rgbd\deployment\.venv
& D:\rgbd\deployment\.venv\Scripts\python.exe -m pip install torch==2.7.1 torchvision==0.22.1 --index-url https://download.pytorch.org/whl/cu126
& D:\rgbd\deployment\.venv\Scripts\python.exe -m pip install transformers==4.53.2 safetensors==0.5.3 numpy==2.3.1 Pillow==11.3.0 pycocotools==2.0.11 scipy==1.16.3 matplotlib==3.10.6 huggingface-hub==0.33.4
& D:\rgbd\deployment\.venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available())"
```

最后一条需输出 `True`。新环境仍须通过模型加载和一次实际推理验收；仅安装依赖并不表示权重、源码与初始化模型匹配。

### 模型文件

- 算法源码：[YuryLee/DPSeg](https://github.com/YuryLee/DPSeg)。使用与权重匹配的版本；本机部署记录的算法提交为 `b38098c`，不要在演示前无验证地更新算法源码。
- 发布权重：[Lemma456/DPSeg](https://huggingface.co/Lemma456/DPSeg)，本机使用 `weights-v1`。将 `configs/released_weights.json` 指定的三份文件放进 `deployment/weights/`，包括 RGB 基线、RGB-D 基座与点头。文件名、大小、摘要须符合清单。
- 公开初始化模型：`facebook/mask2former-swin-tiny-coco-instance`，本机固定版本 `22c4a2f15dc88149b8b8d9f4d42c54431fbd66f6`，放进 `deployment/coco/`。按算法组 `docs/artifacts.md` 准备完整模型、配置和要求的来源记录；仅有三份课程权重不足以构建模型。

服务启动会检查源码、协议、权重及最终张量摘要。不匹配时应检查版本与文件完整性，不应删除校验来绕过错误。本仓库不包含模型下载器或一键初始化安装器；当前设备已准备好上述文件，新机器需要另外获取。

## 二、启动推理服务

**通用启动命令**只依赖本仓库的服务源码，不依赖当前设备上的辅助脚本：

```powershell
Set-Location D:\rgbd\rgbd
$env:PYTHONUTF8 = '1'
$env:DEMO_DEPLOYMENT_ROOT = 'D:\rgbd\deployment'
$env:DPSEG_SOURCE = 'D:\rgbd\DPSeg'
# 模型文件已完整准备后可启用离线模式
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
& D:\rgbd\deployment\.venv\Scripts\python.exe server/service.py --host 0.0.0.0 --port 8000
```

保持该终端运行。模型加载完成后检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/healthz
```

应返回 `status: ready`。端口在模型加载完成后才开始监听；加载期间连接失败并不表示服务已退出，请先查看启动终端。

当前这台设备还可直接运行 `& D:\rgbd\deployment\serve.ps1`，其作用是设置本地路径、缓存与离线环境后启动同一个 `server/service.py`。该脚本不在本仓库中，新机器使用上面的通用命令。

服务默认允许所有来源。若要限制来源，在启动命令末尾加 `--allow-origin http://192.168.1.10:5174`，这里填写**网页的来源**，不是笔记本 IP；多个来源使用逗号分隔。当前服务没有鉴权或 TLS，适用于可信演示网络，不直接公开到互联网。

## 三、准备网页与样例

在本仓库根目录：

```powershell
npm ci
```

生成六个内置样例（需要解压后的课程数据集）：

```powershell
& D:\rgbd\deployment\.venv\Scripts\python.exe -m pip install -r scripts/requirements.txt
& D:\rgbd\deployment\.venv\Scripts\python.exe scripts/prepare_samples.py --dataset D:\rgbd\blender
```

输出在 `public/demo-data/`，被 Git 忽略。生成内容包含原始输入、GT 和样例索引，不包含模型预测。没有生成样例时仍可上传 ZIP，但样例列表会加载失败；需要样例展示的部署必须包含生成文件。

### 开发运行

另开终端执行：

```powershell
npm run dev -- --port 5174 --strictPort
```

同机打开 `http://127.0.0.1:5174/`。默认 API 地址是“网页当前协议 + 当前主机名 + 8000 端口”。例如网页地址为 `http://192.168.1.10:5174/`，就会请求 `http://192.168.1.10:8000`。

### 构建与演示预览

```powershell
npm run check
npm test
npm run build
npm run preview -- --port 5174 --strictPort
```

`dist/` 可交给静态服务器发布；Vite preview 适合本地验收和课程演示，不承担公网生产托管。样例必须在构建前生成，Vite 才会将其复制到 `dist/demo-data/`。发布网页不会同时启动 Python API，推理服务必须持续运行。

## 四、笔记本访问推理主机

### 推荐：网页与 API 均在主机

1. 主机启动 8000 推理服务和 5174 网页，均监听 `0.0.0.0`。
2. 两台设备连接同一可互访网络，查询主机局域网 IPv4（可运行 `ipconfig`）。
3. 主机防火墙在可信私有网络允许网页和 API 端口。
4. 笔记本打开 `http://主机IP:5174/`，选择样例并运行一次。

笔记本上的 `127.0.0.1` 指向笔记本自身，不能用于访问另一台机器的服务。来访设备必须能同时访问网页端口和 8000 API 端口。

### 网页与 API 分开部署

在网页仓库创建 `.env.local`：

```dotenv
VITE_DEMO_API_BASE_URL=http://192.168.1.10:8000
```

填入推理主机真实地址。修改后重启 Vite；已构建的网页需要重新 `npm run build` 再发布。它是构建时配置，不能只在静态服务器启动时修改环境变量。`.env.local` 不提交 Git，可参照根目录 `.env.example`。

如果网页使用 HTTPS，API 也应通过 HTTPS 或同源反向代理访问，避免浏览器阻止混合内容；当前本地示例使用 HTTP。

## HTTP 契约

| 接口 | 用途 |
| --- | --- |
| `GET /healthz` | 模型加载完成后的健康检查 |
| `POST /v1/compare` | multipart 字段 `input_id`、`rgb`、`depth`，不包含 ZIP 或 GT |

响应包含 `input_id` 与 S0/S4 两个模型结果。成功项含名称、版本、耗时、实例类别、置信度与原图坐标下的 COCO 压缩 RLE；失败项包含错误信息。输入要求见根目录 README，类型转换见 `src/backend/http.ts`。模型在服务启动时加载并常驻，同一服务串行执行推理以控制显存占用。

## 验收与排查

| 现象 | 检查 |
| --- | --- |
| 网页无法打开 | 网页进程是否运行、端口是否正确；跨机器访问使用主机 IP |
| 页面可见但推理失败 | 先访问 API `/healthz`，再查 API 地址、CORS、防火墙和启动终端 |
| 提示 CUDA 不可用 | 使用部署虚拟环境检查 PyTorch CUDA 与驱动；当前服务不支持 CPU 回退 |
| 权重或源码摘要错误 | 检查匹配的算法版本、发布文件名和完整下载，不修改校验规则 |
| 样例列表失败 | 检查 `public/demo-data/index.json`；部署构建时是否包含样例 |
| 上传失败 | 检查 ZIP 根目录命名、PNG 位深、尺寸和 GT 实例 ID 格式 |
| 关闭终端后无法访问 | 网页和 Python 服务都需要持续运行；本仓库尚未配置系统自启动服务 |

最终验收：健康检查 ready → 浏览器加载样例 → 点击运行对比 → S0/S4 返回结果 → 调节阈值并检查三图与曲线 → 在演示笔记本上重复一次。上传场景另验证带 GT 和不带 GT 的 ZIP。构建与单元测试通过不能替代跨设备连通性和真实推理验收。
