import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../config/logger';

export interface AssetInfo {
  id: string;
  path: string;
  category: string;
  name: string;
}

let assetIndex: AssetInfo[] = [];
let assetMap: Record<string, AssetInfo> = {};

export function scanAssets(assetsDir: string): AssetInfo[] {
  assetIndex = [];
  assetMap = {};

  if (!fs.existsSync(assetsDir)) {
    logger.warn('assets dir not found: ' + assetsDir);
    return assetIndex;
  }

  function walk(dir: string, category: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, category ? `${category}/${entry.name}` : entry.name);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        const relPath = path.relative(assetsDir, fullPath);
        const nameNoExt = entry.name.replace(/\.png$/i, '');
        // Generate clean ID: replace spaces/dashes, remove parentheses, lowercase
        const cleanName = nameNoExt
          .replace(/[()（）]/g, '')
          .replace(/[\s-]+/g, '_')
          .replace(/[^a-zA-Z0-9_а-яА-ЯёЁ]/g, '')
          .toLowerCase();
        const id = `${category.replace(/\//g, '_')}_${cleanName}`.replace(/[^a-zA-Z0-9_]/g, '_');

        const asset: AssetInfo = {
          id,
          path: `/assets/${relPath}`,
          category: category.replace(/\//g, '/'),
          name: nameNoExt,
        };
        assetIndex.push(asset);
        assetMap[id] = asset;
      }
    }
  }

  walk(assetsDir, '');
  logger.info(`Scanned ${assetIndex.length} assets`);
  return assetIndex;
}

export function getAssetIndex(): AssetInfo[] {
  return assetIndex;
}

export function getAssetById(id: string): AssetInfo | undefined {
  return assetMap[id];
}

export function getAssetsByCategory(category: string): AssetInfo[] {
  return assetIndex.filter(a => a.category === category || a.category.startsWith(category + '/'));
}

export function getAssetIdList(): string[] {
  return assetIndex.map(a => a.id);
}
