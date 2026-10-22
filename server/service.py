"""HTTP service for the RGB-D demo. Loads both course models once at startup."""
from __future__ import annotations

import argparse
from email import policy
from email.parser import BytesParser
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace

REPOSITORY = Path(__file__).resolve().parents[1]
DEPLOYMENT = Path(os.environ.get('DEMO_DEPLOYMENT_ROOT', REPOSITORY.parent / 'deployment'))
SOURCE = Path(os.environ.get('DPSEG_SOURCE', REPOSITORY.parent / 'DPSeg'))
sys.path.insert(0, str(SOURCE))

WIDTH = HEIGHT = 1024
MAX_FILE_BYTES = 30 * 1024 * 1024
MAX_REQUEST_BYTES = 64 * 1024 * 1024
CAMERA_K = [[1910.8100134752654, 0.0, 511.5],
            [0.0, 1910.8100134752654, 511.5],
            [0.0, 0.0, 1.0]]
MODEL_LABELS = {
    'baseline': ('基线模型', 'S0 · epoch 15'),
    'improved': ('改进模型', 'S4 · epoch 15 + head 06'),
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha256(path: Path) -> str:
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def differences(actual, expected, prefix=''):
    if isinstance(actual, dict) and isinstance(expected, dict):
        result = []
        for key in sorted(set(actual) | set(expected)):
            name = f'{prefix}.{key}' if prefix else key
            result.extend(differences(actual.get(key), expected.get(key), name))
        return result
    return [] if actual == expected else [{'field': prefix, 'local': actual, 'training': expected}]


def reconcile_platform_metadata(actual, expected):
    actual = json.loads(json.dumps(actual))
    if 'upstream_source_sha256' in actual:
        hashes = actual['upstream_source_sha256']
        normalized = {key.replace('\\', '/'): value for key, value in hashes.items()}
        if len(normalized) != len(hashes):
            raise RuntimeError('Ambiguous normalized source paths')
        actual['upstream_source_sha256'] = normalized
    diff = differences(actual, expected)
    allowed = all(
        item['field'].split('.')[-1] == 'source_receipt_sha256'
        or item['field'].endswith('changed_tensors.class_predictor.weight.new_sha256')
        for item in diff
    )
    if diff and not allowed:
        raise RuntimeError('Model metadata does not match the released checkpoint')
    return json.loads(json.dumps(expected))


class InferenceService:
    def __init__(self):
        import numpy as np
        import torch
        from rgbd_seg.course_optimized import tensor_digest
        from rgbd_seg.course_portable import load_model, verify_sources
        import rgbd_seg.course_portable as portable
        from rgbd_seg.course_progressive_rgb import build_trainable as build_rgb
        from rgbd_seg.course_depth_data import camera_intrinsics, load_depth_record
        from rgbd_seg.course_benchmark import predict

        if not torch.cuda.is_available():
            raise RuntimeError('CUDA is required by the configured inference host')
        self.np = np
        self.torch = torch
        self.predict = predict
        self.camera_intrinsics = camera_intrinsics
        self.load_depth_record = load_depth_record
        self.device = 'cuda:0'
        self.lock = threading.Lock()

        torch.set_num_threads(4)
        torch.set_num_interop_threads(1)
        torch.manual_seed(17)
        torch.backends.cudnn.benchmark = False
        torch.backends.cuda.matmul.allow_tf32 = False
        torch.backends.cudnn.allow_tf32 = False

        manifest = read_json(SOURCE / 'configs/released_weights.json')
        self.specs = {item['id']: item for item in manifest['weights']}
        for spec in self.specs.values():
            path = DEPLOYMENT / 'weights' / spec['filename']
            if (not path.is_file() or path.stat().st_size != spec['bytes']
                    or sha256(path) != spec['sha256']):
                raise RuntimeError(f'Released weight verification failed: {path.name}')

        print('Loading baseline model (S0)...', flush=True)
        base_spec = self.specs['rgb_e15']
        base_checkpoint = torch.load(DEPLOYMENT / 'weights' / base_spec['filename'],
                                     map_location='cpu', weights_only=True)
        protocol = SOURCE / 'artifacts/protocols/progressive_rgb_continuation10_six_gpu.json'
        if sha256(protocol) != base_checkpoint['protocol_sha256']:
            raise RuntimeError('The frozen baseline training protocol does not match')
        verify_sources(base_checkpoint['source_sha256'])
        baseline, metadata = build_rgb(DEPLOYMENT / 'coco', device='cpu', seed=17)
        reconcile_platform_metadata(metadata, base_checkpoint['model_metadata'])
        baseline.load_state_dict(base_checkpoint['model'], strict=True)
        if tensor_digest(baseline.state_dict()) != base_spec['tensor_sha256']:
            raise RuntimeError('Baseline model tensor digest does not match')
        del base_checkpoint

        print('Loading improved model (S4)...', flush=True)
        rgbd_spec = self.specs['rgbd_e15']
        rgbd_checkpoint = torch.load(DEPLOYMENT / 'weights' / rgbd_spec['filename'],
                                     map_location='cpu', weights_only=True)
        expected = rgbd_checkpoint['model_metadata']
        original_builder = portable.build_trainable

        def relocated_builder(*args, **kwargs):
            adapter, metadata = original_builder(*args, **kwargs)
            return adapter, reconcile_platform_metadata(metadata, expected)

        portable.build_trainable = relocated_builder
        try:
            improved, heads, _ = load_model(
                base_weights=DEPLOYMENT / 'weights' / rgbd_spec['filename'],
                head_weights=DEPLOYMENT / 'weights' / self.specs['points_base15_e06']['filename'],
                coco_checkpoint=DEPLOYMENT / 'coco', device='cpu')
        finally:
            portable.build_trainable = original_builder
        del rgbd_checkpoint

        self.models = {
            'baseline': (baseline.eval().requires_grad_(False).to(self.device), None),
            'improved': (improved.eval().requires_grad_(False).to(self.device),
                         heads.depth.eval().requires_grad_(False).to(self.device)),
        }
        torch.cuda.synchronize()
        print(f"Inference service ready on {torch.cuda.get_device_name(0)}", flush=True)

    @staticmethod
    def _check_png_header(data: bytes, bit_depth: int, color_type: int, label: str):
        if (len(data) < 33 or data[:8] != b'\x89PNG\r\n\x1a\n'
                or data[12:16] != b'IHDR'):
            raise ValueError(f'{label} must be a valid PNG file')
        width = int.from_bytes(data[16:20], 'big')
        height = int.from_bytes(data[20:24], 'big')
        if (width, height) != (WIDTH, HEIGHT):
            raise ValueError('Both images must be 1024 × 1024 pixels')
        if data[24] != bit_depth or data[25] != color_type:
            if label == 'RGB image':
                raise ValueError('RGB must be an 8-bit, three-channel PNG')
            raise ValueError('Depth must be a 16-bit, single-channel PNG')

    def _prepare_sample(self, rgb_bytes: bytes, depth_bytes: bytes):
        from PIL import Image
        import torch
        from rgbd_seg.course_depth_data import load_depth_record

        self._check_png_header(rgb_bytes, 8, 2, 'RGB image')
        self._check_png_header(depth_bytes, 16, 0, 'Depth image')
        with Image.open(io.BytesIO(rgb_bytes)) as image:
            if image.format != 'PNG' or image.mode != 'RGB':
                raise ValueError('RGB must be an 8-bit, three-channel PNG')
            rgb = self.np.array(image, dtype=self.np.uint8, copy=True)
        record = {
            'width': WIDTH,
            'height': HEIGHT,
            'depth_file_name': 'depth.png',
            'depth_scale_m': 0.0001,
            'depth_invalid_code': 0,
            'depth_semantics': 'camera_axis_z',
            'camera': {
                'K': CAMERA_K,
                'resolution': [WIDTH, HEIGHT],
                'pixel_center_convention': 'integer',
            },
        }
        depth, valid = self.load_depth_record(
            SimpleNamespace(read=lambda _: depth_bytes), record)
        sample = {
            'image': torch.from_numpy(rgb).permute(2, 0, 1).float().div_(255),
            'depth_m': depth,
            'depth_valid': valid,
            'camera_K': self.camera_intrinsics(record),
        }
        return sample

    def compare(self, rgb_bytes: bytes, depth_bytes: bytes, input_id: str):
        sample = self._prepare_sample(rgb_bytes, depth_bytes)
        models = []
        # The released models share one GPU. Serialize requests and run each model
        # in order so concurrent browser requests cannot exhaust device memory.
        with self.lock:
            for role, stage in (('baseline', 'S0'), ('improved', 'S4')):
                name, version = MODEL_LABELS[role]
                adapter, head = self.models[role]
                try:
                    self.torch.cuda.synchronize()
                    started = time.perf_counter()
                    with self.torch.inference_mode():
                        predictions = self.predict(stage, adapter, head, sample)
                    self.torch.cuda.synchronize()
                    elapsed = (time.perf_counter() - started) * 1000
                    models.append({
                        'role': role, 'name': name, 'version': version,
                        'elapsed_ms': round(elapsed, 1), 'status': 'success',
                        'predictions': predictions,
                    })
                except Exception:
                    print(f'{stage} inference failed for input {input_id}', flush=True)
                    models.append({
                        'role': role, 'name': name, 'version': version,
                        'elapsed_ms': 0, 'status': 'error',
                        'message': '该模型处理失败，请重试。',
                    })
        return {'input_id': input_id, 'models': models}


def parse_multipart(content_type: str, body: bytes):
    message = BytesParser(policy=policy.default).parsebytes(
        f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode('ascii') + body)
    if not message.is_multipart():
        raise ValueError('Expected multipart form data')
    fields = {}
    for part in message.iter_parts():
        name = part.get_param('name', header='content-disposition')
        if name not in {'rgb', 'depth', 'input_id'} or name in fields:
            raise ValueError('Request must include one RGB image, one depth image and one input ID')
        payload = part.get_payload(decode=True)
        if payload is None:
            raise ValueError('Invalid multipart request')
        fields[name] = payload
    if set(fields) != {'rgb', 'depth', 'input_id'}:
        raise ValueError('Request must include one RGB image, one depth image and one input ID')
    if len(fields['rgb']) > MAX_FILE_BYTES or len(fields['depth']) > MAX_FILE_BYTES:
        raise OverflowError('Each image must be no larger than 30 MB')
    input_id = fields['input_id'].decode('utf-8')
    if not input_id or len(input_id) > 128:
        raise ValueError('Input ID is invalid')
    return fields['rgb'], fields['depth'], input_id


class Handler(BaseHTTPRequestHandler):
    server_version = 'RGBDInference/1.0'

    def _cors(self):
        origin = self.headers.get('Origin')
        allowed = self.server.allowed_origins
        if '*' in allowed:
            self.send_header('Access-Control-Allow-Origin', '*')
        elif origin in allowed:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')

    def _json(self, status: int, value):
        payload = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self._cors()
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '600')
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/healthz':
            self._json(200, {'status': 'ready'})
        else:
            self._json(404, {'error': {'message': '未找到请求的服务。'}})

    def do_POST(self):
        if self.path != '/v1/compare':
            self._json(404, {'error': {'message': '未找到请求的服务。'}})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self._json(400, {'error': {'message': '请求格式无效。'}})
            return
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._json(413 if length > MAX_REQUEST_BYTES else 400,
                       {'error': {'message': '请求大小无效或超过限制。'}})
            return
        content_type = self.headers.get('Content-Type', '')
        if not content_type.lower().startswith('multipart/form-data;'):
            self._json(415, {'error': {'message': '请求格式无效。'}})
            return
        try:
            rgb, depth, input_id = parse_multipart(content_type, self.rfile.read(length))
            result = self.server.inference.compare(rgb, depth, input_id)
            self._json(200, result)
        except OverflowError as error:
            self._json(413, {'error': {'message': str(error)}})
        except (ValueError, UnicodeDecodeError) as error:
            self._json(400, {'error': {'message': str(error)}})
        except Exception:
            print('Comparison request failed during inference', flush=True)
            self._json(500, {'error': {'message': '推理服务暂时无法处理请求，请重试。'}})

    def log_message(self, format, *args):
        # Do not log image payloads or request bodies.
        super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default=os.environ.get('DEMO_API_HOST', '0.0.0.0'))
    parser.add_argument('--port', type=int, default=int(os.environ.get('DEMO_API_PORT', '8000')))
    parser.add_argument('--allow-origin', default=os.environ.get('DEMO_ALLOWED_ORIGINS', '*'))
    args = parser.parse_args()
    service = InferenceService()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    server.inference = service
    server.allowed_origins = {item.strip() for item in args.allow_origin.split(',') if item.strip()}
    print(f'HTTP service listening on {args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Stopping inference service...', flush=True)
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
