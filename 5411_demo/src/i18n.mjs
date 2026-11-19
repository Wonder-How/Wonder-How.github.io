// Local, hand-written UI translations. Scene data and exported schemas stay language-neutral.
const translations = {
  'POTHOLE LAB': '坑洞实验室',
  'COMP5411 / GROUP 19': 'COMP5411 / 第 19 组',
  'FINAL / v1.0': '最终版 / v1.0',
  'How to use ↗': '使用说明 ↗',
  'SURFACE-AWARE GENERATION': '贴合路面的程序化生成',
  'One surface.': '同一路面，',
  'Multiple potholes.': '多个坑洞。',
  'Control the damaged area on the original road, then inspect the geometry and its cost.': '控制原始路面上的破损面积，查看生成的几何形状及计算开销。',
  'Scene': '场景',
  'Reproducible examples': '可复现的示例',
  'Four varied potholes': '四个不同的坑洞',
  'Single-pothole baseline': '单坑洞基准场景',
  'Road-edge damage': '路边破损',
  'Eight-pothole stress scene': '八坑洞压力测试场景',
  'Road surface': '路面形状',
  'Flat': '平面',
  'Slope': '斜坡',
  'Curve': '曲面',
  'Sampling': '采样精度',
  'Low': '低',
  'Medium': '中',
  'High': '高',
  'Mesh construction': '网格构建方式',
  'Local adaptive': '局部自适应',
  'Tensor grid': '张量网格',
  'Allow footprints cut by road edges': '允许坑洞被路面边缘截断',
  'Edge mode solves the area remaining on the road. Overlapping potholes are rejected.': '边缘模式以留在路面内的面积为目标。坑洞重叠时会拒绝该调整。',
  'Potholes': '坑洞列表',
  'Select a pothole': '选择一个坑洞',
  '+ Add pothole': '+ 添加坑洞',
  'Remove selected': '删除选中坑洞',
  'Selected pothole': '选中坑洞',
  'Target footprint': '目标覆盖面积',
  'Maximum depression': '最大坑深',
  'Contour irregularity': '轮廓不规则度',
  'Shape seed': '形状种子',
  'Change shape seed': '更换形状种子',
  'Lateral u': '横向位置 u',
  'Longitudinal v': '纵向位置 v',
  'Ready.': '就绪。',
  'Close view follows the selected pothole': '近景视角跟随选中的坑洞',
  'Save & export': '保存与导出',
  'Export aligned dataset': '导出对齐的数据集',
  'RGB · mask · instance IDs · geometric normals · metric camera depth': '彩色图 · 掩膜 · 实例编号 · 几何法线 · 以米为单位的相机深度',
  'Save scene': '保存场景',
  'Load scene': '载入场景',
  'Analytic height fields · CPU mesh deformation · GLSL shading. No imported terrain or vehicle dynamics.': '解析高度场 · CPU 网格变形 · GLSL 着色。暂不支持导入地形或车辆动力学。',
  'CONTROL → GEOMETRY → EVIDENCE': '参数控制 → 几何生成 → 测量验证',
  'Measurable damage, on the surface.': '贴合路面，可测量的破损。',
  'Expand view ↗': '展开视图 ↗',
  'Restore layout ↙': '恢复布局 ↙',
  'Material': '材质',
  'Wireframe': '线框',
  'Normals': '法线',
  'Mask': '掩膜',
  'Depth': '深度',
  'Instances': '实例',
  'Wide': '全景',
  'Close': '近景',
  'Top': '俯视',
  'Light': '光照',
  'Raking': '掠射光',
  'Soft': '柔光',
  'Orbit light': '旋转光源',
  'Aggregate': '骨料细节',
  'Baseline': '基础材质',
  'Unknown material preset.': '未知的材质预设。',
  'Wetness': '湿润程度',
  'Original road': '原始路面',
  'Footprints': '坑洞轮廓',
  'Building the road…': '正在生成路面…',
  'CURVED ROAD': '曲面路面',
  '8 × 12 m / metres': '8 × 12 m / 单位：米',
  'Drag to orbit · scroll to zoom · right-drag to pan': '左键拖动旋转 · 滚轮缩放 · 右键拖动平移',
  'Original-surface footprint reference': '原始路面上的坑洞覆盖轮廓',
  'Total measured footprint': '实测覆盖总面积',
  'Along original surface normals': '沿原始路面的法线方向测量',
  'Top / border triangles': '路面 / 侧边三角形数',
  'CPU geometry build': 'CPU 几何构建时间',
  'Rendering…': '正在渲染…',
  'Area & sampling': '面积与采样',
  'Cross-section': '截面',
  'Performance & memory': '性能与内存',
  'Every pothole has its own area target.': '每个坑洞都有独立的面积目标。',
  'Relative footprint error = |mesh-measured area − target area| / target area. The area is on the original road, not the pit walls.': '覆盖面积相对误差 = |网格实测面积 − 目标面积| / 目标面积。这里测量的是原始路面上的覆盖面积，不含坑壁。',
  'Compare sampling levels': '比较采样精度',
  'Pothole': '坑洞',
  'Target m²': '目标面积 m²',
  'Measured m²': '实测面积 m²',
  'Error': '误差',
  'Edge': '边缘状态',
  'A direct view of the depth profile.': '直观查看坑洞深度轮廓。',
  'Analytic source-coordinate section through the selected pothole. Dashed = original road; solid = displaced profile.': '经过选中坑洞的解析截面，以原始路面坐标采样。虚线为原始路面，实线为变形后的轮廓。',
  'Across u': '横向 u',
  'Along v': '纵向 v',
  'Measure the render, not just the frame counter.': '测量渲染开销，而非只看帧率。',
  'Fixed 1280 × 720 · GPU timer queries · CPU submit time · buffer memory. Hardware and software renderers are identified explicitly.': '固定 1280 × 720 · GPU 计时查询 · CPU 提交耗时 · 缓冲区内存。明确区分硬件与软件渲染器。',
  'Run 120-frame benchmark': '运行 120 帧基准测试',
  'No measurement yet. The benchmark briefly pauses interaction.': '尚未测量。基准测试期间会短暂暂停交互。',
  'One surface, independently controlled potholes.': '同一路面上的坑洞可独立控制。',
  'Analytic original and displaced road cross-section': '原始路面与变形路面的解析截面',
  'Analytic cross-section, metres': '解析截面，单位：米',
  'source {axis} (m)': '原始坐标 {axis}（m）',
  'height (m)': '高度（m）',
  '← Back to the demo': '← 返回演示',
  'How to use': '使用说明'
};

translations['Pothole Lab · Final · Group 19'] = '坑洞实验室 · 最终版 · 第 19 组';
translations['Controlled pothole footprints, local refinement and measured WebGL rendering.'] = '可控的坑洞覆盖面积、局部网格加密与 WebGL 渲染测量。';

Object.assign(translations, {
  "Selected: {id}": "当前坑洞：{id}",
  "{error} Last valid scene retained.": "{error} 已保留上一个有效场景。",
  "{count} independent potholes · {edgeStatus}.": "{count} 个独立坑洞 · {edgeStatus}。",
  "road-edge clipping enabled": "已启用道路边缘裁剪",
  "full footprints retained": "保留完整坑洞轮廓",
  "{surface} ROAD / {count} POTHOLE": "{surface}路面 / {count} 个坑洞",
  "{surface} ROAD / {count} POTHOLES": "{surface}路面 / {count} 个坑洞",
  "FLAT": "平坦",
  "SLOPED": "倾斜",
  "CURVED": "弯曲",
  "Total error {total}% · max per-hole {max}%": "总面积误差 {total}% · 单坑最大误差 {max}%",
  "Local conforming quadtree": "局部协调四叉树网格",
  "Graded tensor grid": "渐变张量网格",
  "{mesh} · {resolution} · {edges}": "{mesh} · {resolution} · {edges}",
  "adaptive": "自适应网格",
  "graded": "渐变网格",
  "low": "低采样",
  "medium": "中采样",
  "high": "高采样",
  "clipped edges": "裁剪道路边缘",
  "contained footprints": "轮廓位于道路内",
  "Clipped": "已裁剪",
  "Inside": "道路内",
  "Drag to orbit · scroll to zoom · right-drag to pan": "左键拖动旋转 · 滚轮缩放 · 右键拖动平移",
  "Actual mesh topology · local refinement around each pothole": "实际网格拓扑 · 每个坑洞周围局部加密",
  "Camera-space geometric normals · material detail excluded": "相机空间的几何法线 · 不含材质微细节",
  "Visible top-surface footprint · white = damaged road": "可见路面上的坑洞覆盖区域 · 白色为损坏路面",
  "Camera-axis depth preview · 2–14 m · near = white": "相机轴向深度预览 · 2–14 米 · 越近越白",
  "Colored instance preview · exported IDs are raw 8-bit red values": "坑洞实例彩色预览 · 导出的 ID 为红通道原始 8 位数值",
  "Restore layout ↙": "恢复布局 ↙",
  "Expand view ↗": "放大视图 ↗",
  "{renderer} · {timer}": "{renderer} · {timer}",
  "Hardware WebGL": "硬件 WebGL",
  "Software WebGL": "软件 WebGL",
  "WebGL renderer": "WebGL 渲染器",
  "GPU timer available": "GPU 计时可用",
  "GPU timer unavailable": "GPU 计时不可用",
  "{fps} FPS · current browser, not GPU time": "{fps} FPS · 当前浏览器帧率，非 GPU 耗时",
  "Same parameters; only sampling changes. CPU builds: one warm-up + three measured.": "参数相同，仅改变采样精度。CPU 构建：预热 1 次，正式测量 3 次。",
  "Resolution": "采样精度",
  "Top triangles": "路面三角形数",
  "Max per-hole error": "单坑最大误差",
  "CPU median / p95": "CPU 中位数 / p95",
  "Warming up shaders, then collecting {frames} frames at 1280 × 720…": "正在预热着色器，然后以 1280 × 720 采集 {frames} 帧…",
  "{renderer} · {valid}/{frames} valid GPU queries · {discarded} discarded disjoint · 1280 × 720": "{renderer} · 有效 GPU 查询 {valid}/{frames} · 因 GPU 状态不连续丢弃 {discarded} 次 · 1280 × 720",
  "No measurement yet. The benchmark briefly pauses interaction.": "尚未测量。性能测试期间会短暂暂停交互。",
  "GPU elapsed": "GPU 耗时",
  "Unavailable": "不可用",
  "CPU render submission": "CPU 渲染提交耗时",
  "Model typed arrays": "模型类型化数组",
  "Unique storage, counted from actual arrays": "根据实际数组统计的不重复存储量",
  "Geometry upload estimate": "几何上传大小估计",
  "Includes original and border buffers": "包含原始路面与边缘缓冲区",
  "GPU time comes only from timer queries. Frame intervals include browser scheduling. Buffer storage is an estimate, not actual VRAM; JS heap and raw samples are included in the downloaded report.": "GPU 耗时仅来自计时查询。帧间隔包含浏览器调度时间。缓冲区大小为估计值，并非实际显存占用；下载的报告中包含 JS 堆内存信息和原始样本。",
  "EXT_disjoint_timer_query_webgl2 unavailable": "浏览器未提供 EXT_disjoint_timer_query_webgl2 计时扩展",
  "No valid GPU query result (disjoint, unavailable, or query failure).": "没有有效的 GPU 查询结果（GPU 状态不连续、结果不可用或查询失败）。",
  "Exported aligned RGB, mask, instances, normals and metric depth.": "已导出对齐的 RGB、掩码、实例 ID、法线和以米为单位的深度。",
  "Scene restored.": "场景已恢复。",
  "Initialization failed: {error}": "初始化失败：{error}",
  "Wait for the current measurement or export to finish.": "请等待当前测量或导出完成。",
  "Invalid pothole index.": "坑洞序号无效。",
  "At most eight potholes are supported.": "最多支持 8 个坑洞。",
  "No non-overlapping location found. Reduce existing footprints first.": "未找到不重叠的位置，请先缩小现有坑洞的覆盖面积。",
  "No non-overlapping location found.": "未找到不重叠的位置。",
  "Keep at least one pothole.": "请至少保留一个坑洞。",
  "Wait for the current operation.": "请等待当前操作完成。",
  "Unknown inspection mode.": "未知的检查模式。",
  "View must be wide, close, or top.": "视角必须为全景、近景或俯视。",
  "Unknown lighting preset.": "未知的光照预设。",
  "Wetness must be in [0,1].": "湿润度必须在 0 到 1 之间。",
  "Unknown panel.": "未知的面板。",
  "Export dimensions must be 32..4096.": "导出图像的宽高必须在 32 到 4096 像素之间。",
  "Scene JSON is too large.": "场景 JSON 文件过大。",
  "WebGL context was lost during benchmark.": "性能测试期间 WebGL 上下文已丢失。"
});

const preferenceKey = 'pothole-lab-language';
let language = 'en';
try { if (localStorage.getItem(preferenceKey) === 'zh') language = 'zh'; } catch { /* Storage is optional. */ }
let initialized = false;
const staticTexts = [];
const staticAttributes = [];

export function getLanguage() { return language; }

export function t(english, values = {}) {
  const template = language === 'zh' ? (translations[english] ?? english) : english;
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

function translateStaticText(value) {
  const content = value.trim();
  return content && Object.hasOwn(translations, content) ? value.replace(content, t(content)) : value;
}

function applyLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  if (document.querySelector('#viewport')) {
    document.title = t('Pothole Lab · Final · Group 19');
    document.querySelector('meta[name="description"]').content = t('Controlled pothole footprints, local refinement and measured WebGL rendering.');
  }
  for (const [node, original] of staticTexts) if (node.isConnected) node.data = translateStaticText(original);
  for (const [element, name, original] of staticAttributes) if (element.isConnected) element.setAttribute(name, t(original));
  const button = document.querySelector('#language-toggle');
  if (button) {
    button.textContent = language === 'en' ? '中文' : 'English';
    button.title = language === 'en' ? 'Switch to Chinese' : '切换为英文';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(language === 'zh'));
  }
}

export function setLanguage(next, persist = true) {
  if (next !== 'en' && next !== 'zh') return;
  language = next;
  if (persist) try { localStorage.setItem(preferenceKey, language); } catch { /* Keep the in-page switch working. */ }
  if (!initialized) return;
  applyLanguage();
  window.dispatchEvent(new CustomEvent('pothole-language-change', {detail: {language}}));
}

export function initI18n() {
  if (initialized) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('script,style,#language-toggle,[data-help-lang]')) staticTexts.push([node, node.data]);
  }
  for (const element of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
    if (element.closest('#language-toggle,[data-help-lang]')) continue;
    for (const name of ['title', 'aria-label', 'placeholder']) if (element.hasAttribute(name)) staticAttributes.push([element, name, element.getAttribute(name)]);
  }
  initialized = true;
  document.querySelector('#language-toggle')?.addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en'));
  window.addEventListener('storage', event => {
    if (event.key === preferenceKey) setLanguage(event.newValue === 'zh' ? 'zh' : 'en', false);
  });
  applyLanguage();
}

const errorTranslations = {
  'buildRoad options must be an object.': '场景参数必须是一个对象。',
  'surface must be flat, slope, or curve.': '路面形状必须为平面、斜坡或曲面。',
  'Unknown surface. Expected flat, slope, or curve.': '未知路面形状，请选择平面、斜坡或曲面。',
  'resolution must be low, medium, or high.': '采样精度必须为低、中或高。',
  'mesh must be adaptive or graded.': '网格方式必须为局部自适应或张量网格。',
  'edgeMode must be reject or clip.': '边缘模式必须为保留完整坑洞或允许截断。',
  'potholes must contain 1 to 8 potholes.': '场景必须包含 1 至 8 个坑洞。',
  'Pothole ids must be unique strings or numbers.': '每个坑洞的编号必须唯一，且为文字或数字。',
  'origin must contain finite u and v.': '坑洞位置必须包含有效的横向 u 和纵向 v 坐标。',
  'origin must be an object containing finite u and v.': '坑洞位置必须包含有效的横向 u 和纵向 v 坐标。',
  'seed must be uint32.': '形状种子必须是 0 至 4294967295 的整数。',
  'seed must be an unsigned 32-bit integer.': '形状种子必须是 0 至 4294967295 的整数。',
  'Requested visible footprint area cannot fit on this road.': '目标覆盖面积过大，无法放入当前路面。',
  'The complete pothole footprint must fit inside the 8 x 12 m road. Use edgeMode clip or move the pothole inward.': '坑洞轮廓必须完全位于 8 × 12 米路面内。请开启边缘截断，或把坑洞向路面内移动。',
  'The complete pothole footprint must fit inside the 8 x 12 m road. Reduce area or move origin inward.': '坑洞轮廓必须完全位于 8 × 12 米路面内。请减小面积，或把坑洞向路面内移动。',
  'Potholes are too close at the current sampling: an active triangle has mixed owners. Move potholes farther apart or increase resolution.': '当前采样精度下坑洞过近，出现同时属于不同坑洞的三角形。请增大坑洞间距，或提高采样精度。',
  'Cross-section axis must be u or v.': '截面方向必须为横向 u 或纵向 v。',
  'Cross-section samples must be an integer from 2 to 4097.': '截面采样点数必须是 2 至 4097 的整数。',
  'WebGL context was lost during benchmark.': '基准测试期间 WebGL 上下文已丢失。',
  'EXT_disjoint_timer_query_webgl2 unavailable': '浏览器不支持 GPU 计时查询扩展。',
  'No valid GPU query result (disjoint, unavailable, or query failure).': '没有有效的 GPU 计时结果（计时不连续、不可用或查询失败）。'
};

function parameterLabel(name) {
  return name.replace(/potholes\[(\d+)\]/g, (_, i) => `第 ${Number(i) + 1} 个坑洞`)
    .replace(/origin\./g, '位置 ').replace(/area/g, '覆盖面积').replace(/depth/g, '坑深')
    .replace(/roughness/g, '轮廓不规则度').replace(/seed/g, '形状种子');
}

export function translateError(value) {
  const message = String(value?.message ?? value);
  if (language !== 'zh') return message;
  if (errorTranslations[message]) return errorTranslations[message];
  const numeric = message.match(/^(.+?) must be (?:a finite number|finite) in \[([^,]+), ([^\]]+)\]\.$/);
  if (numeric) return `${parameterLabel(numeric[1])}必须是 ${numeric[2]} 至 ${numeric[3]} 之间的有限数值。`;
  const overlap = message.match(/^Potholes (.+) and (.+) overlap conservative support disks\. Move them apart or reduce their areas\. Overlap merging is not implemented\.$/);
  if (overlap) return `坑洞 ${overlap[1]} 与 ${overlap[2]} 的保守支撑区域重叠。请增大间距或减小面积；当前不支持重叠合并。`;
  const quality = message.match(/^Generated mesh failed quality validation \((\d+) inverted, (\d+) degenerate triangles\)\. Reduce depth or roughness, or increase sampling\.$/);
  if (quality) return `网格质量检查未通过（${quality[1]} 个翻转三角形，${quality[2]} 个退化三角形）。请减小坑深或轮廓不规则度，或提高采样精度。`;
  const object = message.match(/^potholes\[(\d+)\] must be an object\.$/);
  if (object) return `第 ${Number(object[1]) + 1} 个坑洞的参数必须是一个对象。`;
  return t(message);
}
