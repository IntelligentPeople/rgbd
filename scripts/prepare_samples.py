"""Create ignored browser fixtures; never modify the source dataset."""
import argparse
import gzip
import json
import shutil
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from pycocotools import mask as coco_mask


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def prepare(dataset, output):
    # Deterministic selection: first low/medium/high scene for each composition.
    candidates = {}
    for path in sorted((dataset / 'annotations' / 'val').glob('*.json.gz')):
        with gzip.open(path, 'rt', encoding='utf-8') as stream:
            data = json.load(stream)
        for image in data['images']:
            key = (image['composition'], image['density'])
            if key not in candidates and image['view'] == 0:
                candidates[key] = (image, [a for a in data['annotations'] if a['image_id'] == image['id']])
        if len(candidates) == 9:
            break
    keys = [(composition, density) for composition in ['single_model', 'cross_class_mixed'] for density in ['low', 'medium', 'high']]
    if any(key not in candidates for key in keys):
        raise ValueError('验证集未找到所需六类样例，请检查数据集路径与完整性。')
    output.mkdir(parents=True, exist_ok=True)
    index = []
    fixture_index = []
    density_names = {'low': '低密度', 'medium': '中密度', 'high': '高密度'}
    for composition, density in keys:
        image, annotations = candidates[(composition, density)]
        sample_id = str(image['id'])
        target = output / sample_id
        target.mkdir(exist_ok=True)
        base = f'/demo-data/{sample_id}'
        shutil.copyfile(dataset / image['file_name'], target / 'rgb.png')
        shutil.copyfile(dataset / image['depth_file_name'], target / 'depth-raw.png')
        rgb_hash = hashlib.sha256((target / 'rgb.png').read_bytes()).hexdigest()
        depth_hash = hashlib.sha256((target / 'depth-raw.png').read_bytes()).hexdigest()
        depth = np.array(Image.open(dataset / image['depth_file_name']), dtype=np.float32)
        valid = depth != image['depth_invalid_code']
        meters = depth * image['depth_scale_m']
        lo, hi = float(meters[valid].min()), float(meters[valid].max())
        t = np.clip((meters - lo) / max(hi - lo, 1e-8), 0, 1)
        # Continuous blue/cyan/yellow depth palette; invalid pixels stay black.
        stops = np.array([[25, 44, 110], [25, 177, 182], [245, 215, 98]])
        colors = np.stack([np.interp(t, [0, .5, 1], stops[:, c]) for c in range(3)], axis=-1).astype(np.uint8)
        colors[~valid] = 0
        Image.fromarray(colors).save(target / 'depth.png')
        fixture = {'gt': [], 'baseline': [], 'improved': []}
        for i, annotation in enumerate(sorted(annotations, key=lambda a: a['id'])):
            rle = dict(annotation['segmentation'])
            if isinstance(rle['counts'], str):
                rle['counts'] = rle['counts'].encode('ascii')
            mask = coco_mask.decode(rle)
            if mask.shape != (image['height'], image['width']):
                raise ValueError('GT 掩码与图像尺寸不一致')
            picture = Image.fromarray((mask * 255).astype(np.uint8))
            gt_name = f'gt-{i}.png'
            picture.save(target / gt_name)
            item = {'id': str(annotation['id']), 'categoryId': annotation['category_id'], 'maskUrl': base + '/' + gt_name}
            fixture['gt'].append(item)
            # Intentionally synthetic examples; these do not represent model quality.
            for role, omit_every, erosion in [('baseline', 4, 3), ('improved', 11, 1)]:
                if i % omit_every == 0:
                    continue
                filename = f'{role}-{i}.png'
                (picture.filter(ImageFilter.MinFilter(erosion)) if erosion > 1 else picture).save(target / filename)
                fixture[role].append({**item, 'maskUrl': base + '/' + filename, 'score': round(.35 + ((i * 17 + 13) % 64) / 100, 2)})
        write_json(target / 'sample.json', {'rgbUrl': base + '/rgb.png', 'rawDepthUrl': base + '/depth-raw.png', 'gt': fixture['gt']})
        write_json(target / 'mock.json', {'baseline': fixture['baseline'], 'improved': fixture['improved']})
        fixture_index.append({'rgbHash': rgb_hash, 'depthHash': depth_hash, 'resultUrl': base + '/mock.json'})
        index.append({'id': sample_id, 'title': f'{density_names[density]} · ' + ('同型零件' if composition == 'single_model' else '混合零件'), 'description': '验证集 / 合成场景 / ' + density_names[density], 'density': density, 'rgbUrl': base + '/rgb.png', 'instanceCount': len(annotations), 'smallCount': sum(a['area'] <= 1024 for a in annotations)})
        print(f'{sample_id}: {len(annotations)} instances, depth {lo:.3f}–{hi:.3f} m')
    write_json(output / 'index.json', index)
    write_json(output / 'mock-index.json', fixture_index)
    print(f'Prepared {len(index)} samples in {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('public/demo-data'))
    args = parser.parse_args()
    prepare(args.dataset.resolve(), args.output.resolve())
