const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

// 图像优化配置
const IMAGE_CONFIG = {
  // 质量设置
  quality: {
    jpeg: 80,
    webp: 75,
    png: 80
  },
  // 最大尺寸
  maxWidth: 1200,
  maxHeight: 1200,
  // 生成 WebP 的格式
  webpFormats: ['png', 'jpg', 'jpeg']
};

/**
 * 优化单个图像文件
 */
async function optimizeImage(inputPath, outputPath) {
  const ext = path.extname(inputPath).toLowerCase().slice(1);
  const filename = path.basename(inputPath, path.extname(inputPath));

  try {
    let pipeline = sharp(inputPath)
      .resize(IMAGE_CONFIG.maxWidth, IMAGE_CONFIG.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

    // 生成 WebP 版本（如果支持）
    if (IMAGE_CONFIG.webpFormats.includes(ext)) {
      const webpPath = path.join(path.dirname(outputPath), `${filename}.webp`);
      await pipeline
        .webp({ quality: IMAGE_CONFIG.quality.webp })
        .toFile(webpPath);
      console.log(`✓ Generated WebP: ${path.relative(process.cwd(), webpPath)}`);
    }

    // 生成优化后的原格式
    switch (ext) {
      case 'png':
        await pipeline.png({ quality: IMAGE_CONFIG.quality.png }).toFile(outputPath);
        break;
      case 'jpg':
      case 'jpeg':
        await pipeline.jpeg({ quality: IMAGE_CONFIG.quality.jpeg }).toFile(outputPath);
        break;
      default:
        // 对于其他格式，直接复制
        await pipeline.toFile(outputPath);
    }

    console.log(`✓ Optimized: ${path.relative(process.cwd(), outputPath)}`);
  } catch (error) {
    console.error(`✗ Failed to optimize ${inputPath}:`, error.message);
  }
}

/**
 * 处理目录中的所有图像
 */
async function processImages(srcDir, destDir) {
  const patterns = ['**/*.png', '**/*.jpg', '**/*.jpeg'];

  for (const pattern of patterns) {
    const files = glob.sync(pattern, { cwd: srcDir });

    for (const file of files) {
      const inputPath = path.join(srcDir, file);
      const outputPath = path.join(destDir, file);

      // 如果输入和输出路径相同，跳过（避免覆盖源文件）
      if (path.resolve(inputPath) === path.resolve(outputPath)) {
        console.log(`⏭️  Skipping ${path.relative(process.cwd(), inputPath)} (same input/output path)`);
        continue;
      }

      // 确保输出目录存在
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      await optimizeImage(inputPath, outputPath);
    }
  }
}

/**
 * 生成 WebP 检测脚本
 */
function generateWebpDetectionScript() {
  const script = `
// WebP 支持检测
function supportsWebP() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

// 为支持 WebP 的浏览器设置类
document.documentElement.classList.add(supportsWebP() ? 'webp' : 'no-webp');
`;

  return script;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const srcDir = args[0] || '.';
  const destDir = args[1] || 'dist';

  console.log('🚀 Starting image optimization...');
  console.log(`Source: ${srcDir}`);
  console.log(`Destination: ${destDir}`);

  // 处理图像
  await processImages(srcDir, destDir);

  // 生成 WebP 检测脚本
  const webpScript = generateWebpDetectionScript();
  const scriptPath = path.join(destDir, 'js', 'webp-detect.js');
  const scriptDir = path.dirname(scriptPath);

  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }

  fs.writeFileSync(scriptPath, webpScript);
  console.log(`✓ Generated WebP detection script: ${path.relative(process.cwd(), scriptPath)}`);

  console.log('✅ Image optimization complete!');
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { optimizeImage, processImages, generateWebpDetectionScript };