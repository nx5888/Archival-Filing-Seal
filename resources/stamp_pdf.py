# resources/stamp_pdf.py
# PDF 盖章 + 页码叠加引擎
# 依赖: pip install reportlab pypdf
#
# 用法: python stamp_pdf.py <input_pdf> <output_pdf> <config.json> <schema.json>

import sys
import json
import os
import io
from pathlib import Path

try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    print("ERROR: 需要安装 reportlab: pip install reportlab", file=sys.stderr)
    sys.exit(1)

try:
    import pypdf
    _USE_PYPDF2 = False
except ImportError:
    try:
        from PyPDF2 import PdfReader as P2Reader, PdfWriter as P2Writer, PdfMerger as P2Merger
        _USE_PYPDF2 = True
        pypdf = None  # type: ignore
    except ImportError:
        print("ERROR: 需要安装 pypdf 或 PyPDF2: pip install pypdf", file=sys.stderr)
        sys.exit(1)


# ========== 字体加载 ==========

def find_chinese_font():
    candidates = [
        r"C:\Windows\Fonts\simfang.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\msyh.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/wqy-zenhei/wqy-zenhei.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def register_font(font_path=None):
    if font_path is None:
        font_path = find_chinese_font()
    if font_path is None:
        return None
    font_name = "ChineseFont"
    ext = os.path.splitext(font_path)[1].lower()
    try:
        if ext == ".ttc":
            pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=0))
        else:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
        return font_name
    except Exception as e:
        print(f"WARN: 字体注册失败 ({e}): {font_path}", file=sys.stderr)
        return None


# ========== 归档章绘制 ==========

def draw_stamp_on_canvas(c, page_width_pt, page_height_pt, config, schema):
    """在 canvas 上绘制归档章"""
    offset_x_mm = config.get("stamp_offset_mm", [15.0, 10.0])[0]
    offset_y_mm = config.get("stamp_offset_mm", [15.0, 10.0])[1]

    stamp_w_mm = float(schema.get("width_mm", 60))
    stamp_h_mm = float(schema.get("height_mm", 45))

    origin_x_pt = offset_x_mm * mm
    origin_y_pt = offset_y_mm * mm
    stamp_w_pt = stamp_w_mm * mm
    stamp_h_pt = stamp_h_mm * mm

    cells = schema.get("cells", [])

    # 外边框
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.5)
    c.rect(origin_x_pt, origin_y_pt, stamp_w_pt, stamp_h_pt)

    font_name = getattr(c, '_chinese_font', 'Helvetica')

    for cell in cells:
        x_pct = cell.get("x_pct", 0)
        y_pct = cell.get("y_pct", 0)
        w_pct = cell.get("w_pct", 100)
        h_pct = cell.get("h_pct", 100)

        cell_x = origin_x_pt + (x_pct / 100.0) * stamp_w_pt
        cell_y = origin_y_pt + (y_pct / 100.0) * stamp_h_pt
        cell_w = (w_pct / 100.0) * stamp_w_pt
        cell_h = (h_pct / 100.0) * stamp_h_pt

        field_key = cell.get("field_key", "")
        label = str(cell.get("label", ""))
        value = get_field_value(field_key, config)

        # 单元格边框
        c.rect(cell_x, cell_y, cell_w, cell_h)

        # 文字内容
        text_content = f"{label}{value}" if label and value else (label or value or "")
        if text_content:
            font_size = max(6, min(14, min(cell_h * 0.4, min(cell_w, cell_h) * 0.35)))

            c.setFont(font_name, font_size)
            c.setFillColorRGB(0, 0, 0)

            text_width = c.stringWidth(text_content, font_name, font_size)
            if text_width > cell_w - 3:
                while text_width > cell_w - 3 and font_size > 5:
                    font_size -= 0.5
                    c.setFont(font_name, font_size)
                    text_width = c.stringWidth(text_content, font_name, font_size)
                if font_size <= 5:
                    while len(text_content) > 0 and text_width > cell_w - 3:
                        text_content = text_content[:-1]
                        text_width = c.stringWidth(text_content + "..", font_name, font_size)
                    text_content = text_content + ".."

            tx = cell_x + (cell_w - text_width) / 2
            ty = cell_y + cell_h / 2 - font_size / 3
            c.drawString(tx, ty, text_content)


    # --- 叠加印章图片 ---
    seal_path = config.get("seal_image_path")
    if seal_path and os.path.exists(seal_path):
        draw_seal_on_canvas(c, origin_x_pt, origin_y_pt, stamp_w_pt, stamp_h_pt, config, seal_path)

def get_field_value(key, config):
    mapping = {
        "fonds_code": config.get("fonds_code", ""),
        "year": config.get("year", ""),
        "retention": config.get("retention", ""),
        "project_code": config.get("project_code", ""),
        "security_class": config.get("security_class", ""),
        "file_count": config.get("file_count", ""),
        "page_count": config.get("page_count", ""),
    }
    return mapping.get(key, config.get(key, ""))


# ========== 页码添加 ==========

def draw_seal_on_canvas(c, origin_x_pt, origin_y_pt, stamp_w_pt, stamp_h_pt, config, seal_path):
    """在 canvas 上绘制印章图片（支持透明度）"""
    seal_x_pct = config.get("seal_x_pct", 50.0)
    seal_y_pct = config.get("seal_y_pct", 50.0)
    seal_w_mm = config.get("seal_w_mm", None)
    seal_h_mm = config.get("seal_h_mm", None)

    if seal_w_mm is None:
        seal_w_pt = stamp_w_pt * 0.6
    else:
        seal_w_pt = seal_w_mm * mm

    if seal_h_mm is None:
        seal_h_pt = seal_w_pt
    else:
        seal_h_pt = seal_h_mm * mm

    seal_x = origin_x_pt + (seal_x_pct / 100.0) * stamp_w_pt - seal_w_pt / 2
    seal_y = origin_y_pt + (seal_y_pct / 100.0) * stamp_h_pt - seal_h_pt / 2

    c.drawImage(seal_path, seal_x, seal_y, width=seal_w_pt, height=seal_h_pt, mask=None)

def add_page_numbers(reader, writer, page_number_cfg, font_name="Helvetica"):
    """在每页指定位置添加页码文字

    通过生成单页页码 overlay PDF，逐页 merge_page 实现。
    支持配置项：
      scope          范围: all-pages | skip-first | odd-only | even-only | range
      numbering_mode 编号模式: per-file | continuous
      start_number   起始数字
      format         格式字符串，如 "-{n}-"、"{n}/{total}"
      zero_pad       前导零宽度
      position_v     垂直位置: top | bottom
      position_h     水平位置: left | center | right
      offset_mm      [X偏移mm, Y偏移mm] (距边缘距离)
      font_family    字体族
      font_size_pt   字号(pt)
      bold/italic    样式
      opacity        不透明度 (0-255)
      mirror_odd_even 奇偶页镜像
    """
    if not page_number_cfg or not page_number_cfg.get("enabled"):
        return

    enabled = page_number_cfg.get("enabled", False)
    if not enabled:
        return

    scope = page_number_cfg.get("scope", "all-pages")
    numbering_mode = page_number_cfg.get("numbering_mode", "continuous")
    start_num = page_number_cfg.get("start_number", 1)
    zero_pad_val = page_number_cfg.get("zero_pad", 0)
    fmt_str = page_number_cfg.get("format", "{n}")
    pos_v = page_number_cfg.get("position_v", "bottom")
    pos_h = page_number_cfg.get("position_h", "center")
    offset_mm = page_number_cfg.get("offset_mm", [15.0, 10.0])
    font_size_pt = page_number_cfg.get("font_size_pt", 9.0)

    total_pages = len(reader.pages)
    page_counter = 0  # 用于 per-file 计数

    for idx, page in enumerate(reader.pages):
        # 判断是否跳过此页
        should_skip = False

        if scope == "skip-first" and idx == 0:
            should_skip = True
        elif scope == "odd-only" and (idx + 1) % 2 == 0:
            should_skip = True
        elif scope == "even-only" and (idx + 1) % 2 != 0:
            should_skip = True
        elif scope == "range":
            page_range = page_number_cfg.get("page_range", "")
            if page_range:
                try:
                    parts = page_range.split("-")
                    if len(parts) == 2:
                        lo, hi = int(parts[0].strip()), int(parts[1].strip())
                        if not (lo <= (idx + 1) <= hi):
                            should_skip = True
                except ValueError:
                    pass  # 解析失败则不跳过

        if should_skip:
            continue

        # 计算页码数字
        if numbering_mode == "per-file":
            page_counter += 1
            num = start_num + page_counter - 1
        else:
            num = start_num + idx

        # 格式化页码文本
        num_str = str(num).zfill(zero_pad_val) if zero_pad_val > 0 else str(num)
        text = fmt_str.replace("{n}", num_str).replace("{total}", str(total_pages))

        # 获取页面尺寸
        media_box = page.mediabox
        page_w_pt = float(media_box.width)
        page_h_pt = float(media_box.height)

        # 计算 X 坐标
        off_x = offset_mm[0] * mm
        off_y = offset_mm[1] * mm

        # 奇偶页镜像：奇数页右对齐、偶数页左对齐（或反之）
        effective_pos_h = pos_h
        if page_number_cfg.get("mirror_odd_even", False):
            if (idx + 1) % 2 == 0:  # 偶数页
                effective_pos_h = "right" if pos_h == "left" else ("left" if pos_h == "right" else pos_h)

        # 使用 reportlab 创建单页页码 overlay
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(page_w_pt, page_h_pt))

        # 设置字体和颜色
        c.setFont(font_name, font_size_pt)

        # 字体颜色（支持 RGB）
        fc = page_number_cfg.get("font_color", [0, 0, 0])
        if len(fc) >= 3:
            c.setFillColorRGB(fc[0] / 255.0, fc[1] / 255.0, fc[2] / 255.0)
        else:
            c.setFillColorRGB(0, 0, 0)

        # 不透明度（通过 alpha 实现）
        opacity = page_number_cfg.get("opacity", 255)
        if opacity < 255:
            c.setFillAlpha(opacity / 255.0)

        # 计算文字位置
        text_width_pt = c.stringWidth(text, font_name, font_size_pt)

        if effective_pos_h == "left":
            text_x = off_x
        elif effective_pos_h == "right":
            text_x = page_w_pt - off_x - text_width_pt
        else:  # center
            text_x = page_w_pt / 2 - text_width_pt / 2

        if pos_v == "top":
            text_y = page_h_pt - off_y
        else:  # bottom
            text_y = off_y

        c.drawString(text_x, text_y, text)
        c.save()

        # 将 overlay 合并到当前页
        buf.seek(0)
        overlay_reader_cls = P2Reader if _USE_PYPDF2 else pypdf.PdfReader
        overlay_reader = overlay_reader_cls(buf)
        overlay_page = overlay_reader.pages[0]
        page.merge_page(overlay_page)


# ========== 主流程 ==========

def main():
    if len(sys.argv) < 2:
        print(f"用法1(盖章): {sys.argv[0]} <输入PDF> <输出PDF> <config.json> <schema.json>", file=sys.stderr)
        print(f"用法2(预览): {sys.argv[0]} --preview <输入PDF> <输出PNG> <config.json> <schema.json> [--dpi 150]", file=sys.stderr)
        sys.exit(1)

    if sys.argv[1] == "--preview":
        # 预览模式: python stamp_pdf.py --preview input output.png config.json schema.json [--dpi 150]
        if len(sys.argv) < 6:
            print("预览模式参数不足", file=sys.stderr)
            sys.exit(1)
        input_path = sys.argv[2]
        output_png = sys.argv[3]
        config_json_path = sys.argv[4]
        schema_json_path = sys.argv[5]
        dpi = 150
        if "--dpi" in sys.argv:
            idx = sys.argv.index("--dpi")
            if idx + 1 < len(sys.argv):
                try:
                    dpi = int(sys.argv[idx + 1])
                except ValueError:
                    pass
        result = generate_preview(input_path, output_png, config_json_path, schema_json_path, dpi)
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result.get("status") == "ok" else 1)

    # 默认：盖章模式
    if len(sys.argv) != 5:
        print(f"用法: {sys.argv[0]} <输入PDF> <输出PDF> <config.json> <schema.json>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    config_json_path = sys.argv[3]
    schema_json_path = sys.argv[4]

    with open(config_json_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    with open(schema_json_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # 注册中文字体
    font_name = register_font()
    if font_name is None:
        print("WARN: 未找到中文字体，将使用 Helvetica 替代（中文可能无法正常显示）",
              file=sys.stderr)

    # 打开原始 PDF
    if _USE_PYPDF2:
        reader = P2Reader(input_path)
    else:
        reader = pypdf.PdfReader(input_path)
    total_pages = len(reader.pages)

    first_page = reader.pages[0]
    mediabox = first_page.mediabox
    page_w_pt = float(mediabox.width)
    page_h_pt = float(mediabox.height)

    # --- 步骤1：生成归档章叠加层 ---
    overlay_path = input_path + ".stamp_overlay.tmp"
    c = canvas.Canvas(overlay_path, pagesize=(page_w_pt, page_h_pt))
    c._chinese_font = font_name or "Helvetica"

    draw_stamp_on_canvas(c, page_w_pt, page_h_pt, config, schema)
    c.save()

    # --- 步骤2：合并归档章到原 PDF 第1页 + 页码 ---
    if _USE_PYPDF2:
        writer = P2Writer()
        overlay_rdr = P2Reader(overlay_path)
        overlay_pg = overlay_rdr.pages[0]
    else:
        writer = pypdf.PdfWriter()
        overlay_rdr = pypdf.PdfReader(overlay_path)
        overlay_pg = overlay_rdr.pages[0]

    for i, page in enumerate(reader.pages):
        if i == 0:
            page.merge_page(overlay_pg)
        if not _USE_PYPDF2:
            writer.add_page(page)
        else:
            writer.add_page(page)

    # --- 步骤3：添加页码（如果启用）---
    pn_config = config.get("page_number", {})
    if pn_config.get("enabled"):
        tmp_stamped = input_path + ".tmp_with_stamp"
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        if _USE_PYPDF2:
            with open(tmp_stamped, "wb") as out_f:
                writer.write(out_f)
            final_writer = P2Writer()
            final_reader = P2Reader(tmp_stamped)
            add_page_numbers_pypdf2(final_reader, final_writer, pn_config, font_name or "Helvetica")
            with open(output_path, "wb") as out_f:
                final_writer.write(out_f)
            os.remove(tmp_stamped)
        else:
            with open(tmp_stamped, "wb") as out_f:
                writer.write(out_f)
            final_writer = pypdf.PdfWriter()
            final_reader = pypdf.PdfReader(tmp_stamped)
            add_page_numbers_pypdf(final_reader, final_writer, pn_config, font_name or "Helvetica")
            with open(output_path, "wb") as out_f:
                final_writer.write(out_f)
            os.remove(tmp_stamped)
    else:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        if _USE_PYPDF2:
            with open(output_path, "wb") as out_f:
                writer.write(out_f)
        else:
            with open(output_path, "wb") as out_f:
                writer.write(out_f)

    # --- 步骤4：清理临时文件 ---
    if os.path.exists(overlay_path):
        os.remove(overlay_path)

    result = {
        "status": "ok",
        "output_path": os.path.abspath(output_path),
        "total_pages": total_pages,
    }
    print(json.dumps(result, ensure_ascii=False))


# ========== PyPDF2 / pypdf 版本的页码函数 ==========

def add_page_numbers_pypdf2(reader, writer, cfg, font_name="Helvetica"):
    """PyPDF2 路径的页码添加实现"""
    scope = cfg.get("scope", "all-pages")
    numbering_mode = cfg.get("numbering_mode", "continuous")
    start_num = cfg.get("start_number", 1)
    zero_pad_val = cfg.get("zero_pad", 0)
    fmt_str = cfg.get("format", "{n}")
    pos_v = cfg.get("position_v", "bottom")
    pos_h = cfg.get("position_h", "center")
    offset_mm = cfg.get("offset_mm", [15.0, 10.0])
    font_size_pt = cfg.get("font_size_pt", 9.0)

    total_pages = len(reader.pages)
    page_counter = 0

    for idx, page in enumerate(reader.pages):
        if _should_skip_page(idx, scope, cfg):
            continue

        if numbering_mode == "per-file":
            page_counter += 1
            num = start_num + page_counter - 1
        else:
            num = start_num + idx

        num_str = str(num).zfill(zero_pad_val) if zero_pad_val > 0 else str(num)
        text = fmt_str.replace("{n}", num_str).replace("{total}", str(total_pages))

        page_w_pt = float(page.mediabox.width)
        page_h_pt = float(page.mediabox.height)
        off_x = offset_mm[0] * mm
        off_y = offset_mm[1] * mm

        effective_pos_h = _get_effective_position(pos_h, cfg.get("mirror_odd_even", False), idx)

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(page_w_pt, page_h_pt))
        c.setFont(font_name, font_size_pt)

        fc = cfg.get("font_color", [0, 0, 0])
        if len(fc) >= 3:
            c.setFillColorRGB(fc[0] / 255.0, fc[1] / 255.0, fc[2] / 255.0)

        opacity = cfg.get("opacity", 255)
        if opacity < 255:
            c.setFillAlpha(opacity / 255.0)

        tw = c.stringWidth(text, font_name, font_size_pt)
        if effective_pos_h == "left":
            tx = off_x
        elif effective_pos_h == "right":
            tx = page_w_pt - off_x - tw
        else:
            tx = page_w_pt / 2 - tw / 2

        ty = page_h_pt - off_y if pos_v == "top" else off_y
        c.drawString(tx, ty, text)
        c.save()

        buf.seek(0)
        ovr = P2Reader(buf)
        page.merge_page(ovr.pages[0])
        writer.add_page(page)


def add_page_numbers_pypdf(reader, writer, cfg, font_name="Helvetica"):
    """pypdf 路径的页码添加实现"""
    scope = cfg.get("scope", "all-pages")
    numbering_mode = cfg.get("numbering_mode", "continuous")
    start_num = cfg.get("start_number", 1)
    zero_pad_val = cfg.get("zero_pad", 0)
    fmt_str = cfg.get("format", "{n}")
    pos_v = cfg.get("position_v", "bottom")
    pos_h = cfg.get("position_h", "center")
    offset_mm = cfg.get("offset_mm", [15.0, 10.0])
    font_size_pt = cfg.get("font_size_pt", 9.0)

    total_pages = len(reader.pages)
    page_counter = 0

    for idx, page in enumerate(reader.pages):
        if _should_skip_page(idx, scope, cfg):
            continue

        if numbering_mode == "per-file":
            page_counter += 1
            num = start_num + page_counter - 1
        else:
            num = start_num + idx

        num_str = str(num).zfill(zero_pad_val) if zero_pad_val > 0 else str(num)
        text = fmt_str.replace("{n}", num_str).replace("{total}", str(total_pages))

        page_w_pt = float(page.mediabox.width)
        page_h_pt = float(page.mediabox.height)
        off_x = offset_mm[0] * mm
        off_y = offset_mm[1] * mm

        effective_pos_h = _get_effective_position(pos_h, cfg.get("mirror_odd_even", False), idx)

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(page_w_pt, page_h_pt))
        c.setFont(font_name, font_size_pt)

        fc = cfg.get("font_color", [0, 0, 0])
        if len(fc) >= 3:
            c.setFillColorRGB(fc[0] / 255.0, fc[1] / 255.0, fc[2] / 255.0)

        opacity = cfg.get("opacity", 255)
        if opacity < 255:
            c.setFillAlpha(opacity / 255.0)

        tw = c.stringWidth(text, font_name, font_size_pt)
        if effective_pos_h == "left":
            tx = off_x
        elif effective_pos_h == "right":
            tx = page_w_pt - off_x - tw
        else:
            tx = page_w_pt / 2 - tw / 2

        ty = page_h_pt - off_y if pos_v == "top" else off_y
        c.drawString(tx, ty, text)
        c.save()

        buf.seek(0)
        ovr = pypdf.PdfReader(buf)
        page.merge_page(ovr.pages[0])
        writer.add_page(page)


def _should_skip_page(idx, scope, cfg):
    """判断是否应跳过该页"""
    if scope == "skip-first" and idx == 0:
        return True
    if scope == "odd-only" and (idx + 1) % 2 == 0:
        return True
    if scope == "even-only" and (idx + 1) % 2 != 0:
        return True
    if scope == "range":
        pr = cfg.get("page_range", "")
        if pr:
            try:
                parts = pr.split("-")
                if len(parts) == 2:
                    lo, hi = int(parts[0]), int(parts[1])
                    if not (lo <= (idx + 1) <= hi):
                        return True
            except ValueError:
                pass
    return False


def _get_effective_position(pos_h, mirror, idx):
    """计算实际水平位置（考虑奇偶页镜像）"""
    if not mirror:
        return pos_h
    if (idx + 1) % 2 == 0:
        return "right" if pos_h == "left" else ("left" if pos_h == "right" else pos_h)
    return pos_h


# ========== 预览功能（PDF → PNG）==========

def pdf_to_image(input_pdf_path, output_png_path, dpi=150):
    """将 PDF 第一页转换为 PNG 图片（使用 PyMuPDF/fitz）

    Args:
        input_pdf_path: 输入 PDF 文件路径
        output_png_path: 输出 PNG 文件路径
        dpi: 渲染 DPI（默认 150，建议 150-300）

    Returns:
        dict: {"status": "ok", "output_path": "...", "width": w, "height": h}
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return {"status": "error", "error": "需要安装 PyMuPDF: pip install pymupdf"}

    doc = fitz.open(input_pdf_path)
    if len(doc) == 0:
        doc.close()
        return {"status": "error", "error": "PDF 文件为空"}

    page = doc.load_page(0)  # 第1页
    mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
    pix = page.get_pixmap(matrix=mat)

    os.makedirs(os.path.dirname(os.path.abspath(output_png_path)), exist_ok=True)
    pix.save(output_png_path)
    doc.close()

    return {
        "status": "ok",
        "output_path": os.path.abspath(output_png_path),
        "width": pix.width,
        "height": pix.height,
    }


def generate_preview(input_pdf, output_png, config_json_path, schema_json_path, dpi=150):
    """生成盖章预览图：先盖章到临时 PDF，再转为 PNG

    Args:
        input_pdf: 输入 PDF 路径
        output_png: 输出 PNG 路径
        config_json_path: 配置文件路径
        schema_json_path: Schema 文件路径
        dpi: 渲染 DPI

    Returns:
        dict: 结果字典
    """
    import tempfile

    # 1. 创建临时盖章 PDF
    tmp_pdf = tempfile.mktemp(suffix=".pdf")

    # 2. 调用盖章逻辑（复用 main 中的逻辑）
    with open(config_json_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    with open(schema_json_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # 注册中文字体
    font_name = register_font()
    if font_name is None:
        print("WARN: 未找到中文字体，将使用 Helvetica", file=sys.stderr)

    # 打开原始 PDF
    if _USE_PYPDF2:
        reader = P2Reader(input_pdf)
    else:
        reader = pypdf.PdfReader(input_pdf)

    first_page = reader.pages[0]
    mediabox = first_page.mediabox
    page_w_pt = float(mediabox.width)
    page_h_pt = float(mediabox.height)

    # 生成归档章叠加层
    overlay_path = tmp_pdf + ".overlay.tmp"
    c = canvas.Canvas(overlay_path, pagesize=(page_w_pt, page_h_pt))
    c._chinese_font = font_name or "Helvetica"
    draw_stamp_on_canvas(c, page_w_pt, page_h_pt, config, schema)
    c.save()

    # 合并归档章到第1页
    writer = pypdf.PdfWriter() if not _USE_PYPDF2 else P2Writer()
    overlay_rdr = (pypdf.PdfReader if not _USE_PYPDF2 else P2Reader)(overlay_path)
    overlay_pg = overlay_rdr.pages[0]

    for i, page in enumerate(reader.pages):
        if i == 0:
            page.merge_page(overlay_pg)
        if not _USE_PYPDF2:
            writer.add_page(page)
        else:
            writer.add_page(page)

    # 写出临时盖章 PDF
    with open(tmp_pdf, "wb") as f:
        if not _USE_PYPDF2:
            writer.write(f)
        else:
            writer.write(f)

    # 添加页码（如果启用）
    pn_config = config.get("page_number", {})
    if pn_config.get("enabled"):
        if _USE_PYPDF2:
            add_page_numbers_pypdf2_final(tmp_pdf, pn_config, font_name or "Helvetica")
        else:
            add_page_numbers_pypdf_final(tmp_pdf, pn_config, font_name or "Helvetica")

    # 3. 将盖章后的 PDF 转为 PNG
    result = pdf_to_image(tmp_pdf, output_png, dpi)

    # 4. 清理临时文件
    for tmp_f in [tmp_pdf, overlay_path]:
        if os.path.exists(tmp_f):
            try:
                os.remove(tmp_f)
            except Exception:
                pass

    return result


def add_page_numbers_pypdf_final(tmp_pdf_path, cfg, font_name):
    """最终版：对临时 PDF 文件添加页码并覆盖"""
    from io import BytesIO
    reader = pypdf.PdfReader(tmp_pdf_path)
    writer = pypdf.PdfWriter()
    # 复用前面的 add_page_numbers 逻辑，但输出到新文件
    # 简化：直接调用 add_page_numbers
    # 注意：这里需要重新实现，因为原函数需要 reader/writer 对象
    scope = cfg.get("scope", "all-pages")
    numbering_mode = cfg.get("numbering_mode", "continuous")
    start_num = cfg.get("start_number", 1)
    zero_pad_val = cfg.get("zero_pad", 0)
    fmt_str = cfg.get("format", "{n}")
    pos_v = cfg.get("position_v", "bottom")
    pos_h = cfg.get("position_h", "center")
    offset_mm = cfg.get("offset_mm", [15.0, 10.0])
    font_size_pt = cfg.get("font_size_pt", 9.0)
    total_pages = len(reader.pages)
    page_counter = 0

    for idx, page in enumerate(reader.pages):
        if _should_skip_page(idx, scope, cfg):
            writer.add_page(page)
            continue
        if numbering_mode == "per-file":
            page_counter += 1
            num = start_num + page_counter - 1
        else:
            num = start_num + idx
        num_str = str(num).zfill(zero_pad_val) if zero_pad_val > 0 else str(num)
        text = fmt_str.replace("{n}", num_str).replace("{total}", str(total_pages))
        page_w_pt = float(page.mediabox.width)
        page_h_pt = float(page.mediabox.height)
        off_x = offset_mm[0] * mm
        off_y = offset_mm[1] * mm
        effective_pos_h = _get_effective_position(pos_h, cfg.get("mirror_odd_even", False), idx)
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=(page_w_pt, page_h_pt))
        c.setFont(font_name, font_size_pt)
        fc = cfg.get("font_color", [0, 0, 0])
        if len(fc) >= 3:
            c.setFillColorRGB(fc[0] / 255.0, fc[1] / 255.0, fc[2] / 255.0)
        opacity = cfg.get("opacity", 255)
        if opacity < 255:
            c.setFillAlpha(opacity / 255.0)
        tw = c.stringWidth(text, font_name, font_size_pt)
        if effective_pos_h == "left":
            tx = off_x
        elif effective_pos_h == "right":
            tx = page_w_pt - off_x - tw
        else:
            tx = page_w_pt / 2 - tw / 2
        ty = page_h_pt - off_y if pos_v == "top" else off_y
        c.drawString(tx, ty, text)
        c.save()
        buf.seek(0)
        ovr = pypdf.PdfReader(buf)
        page.merge_page(ovr.pages[0])
        writer.add_page(page)
    with open(tmp_pdf_path, "wb") as f:
        writer.write(f)


def add_page_numbers_pypdf2_final(tmp_pdf_path, cfg, font_name):
    """PyPDF2 最终版：对临时 PDF 文件添加页码并覆盖"""
    from io import BytesIO
    reader = P2Reader(tmp_pdf_path)
    writer = P2Writer()
    scope = cfg.get("scope", "all-pages")
    numbering_mode = cfg.get("numbering_mode", "continuous")
    start_num = cfg.get("start_number", 1)
    zero_pad_val = cfg.get("zero_pad", 0)
    fmt_str = cfg.get("format", "{n}")
    pos_v = cfg.get("position_v", "bottom")
    pos_h = cfg.get("position_h", "center")
    offset_mm = cfg.get("offset_mm", [15.0, 10.0])
    font_size_pt = cfg.get("font_size_pt", 9.0)
    total_pages = len(reader.pages)
    page_counter = 0

    for idx, page in enumerate(reader.pages):
        if _should_skip_page(idx, scope, cfg):
            writer.add_page(page)
            continue
        if numbering_mode == "per-file":
            page_counter += 1
            num = start_num + page_counter - 1
        else:
            num = start_num + idx
        num_str = str(num).zfill(zero_pad_val) if zero_pad_val > 0 else str(num)
        text = fmt_str.replace("{n}", num_str).replace("{total}", str(total_pages))
        page_w_pt = float(page.mediabox.width)
        page_h_pt = float(page.mediabox.height)
        off_x = offset_mm[0] * mm
        off_y = offset_mm[1] * mm
        effective_pos_h = _get_effective_position(pos_h, cfg.get("mirror_odd_even", False), idx)
        buf = BytesIO()
        c = canvas.Canvas(buf, pagesize=(page_w_pt, page_h_pt))
        c.setFont(font_name, font_size_pt)
        fc = cfg.get("font_color", [0, 0, 0])
        if len(fc) >= 3:
            c.setFillColorRGB(fc[0] / 255.0, fc[1] / 255.0, fc[2] / 255.0)
        opacity = cfg.get("opacity", 255)
        if opacity < 255:
            c.setFillAlpha(opacity / 255.0)
        tw = c.stringWidth(text, font_name, font_size_pt)
        if effective_pos_h == "left":
            tx = off_x
        elif effective_pos_h == "right":
            tx = page_w_pt - off_x - tw
        else:
            tx = page_w_pt / 2 - tw / 2
        ty = page_h_pt - off_y if pos_v == "top" else off_y
        c.drawString(tx, ty, text)
        c.save()
        buf.seek(0)
        ovr = P2Reader(buf)
        page.merge_page(ovr.pages[0])
        writer.add_page(page)
    with open(tmp_pdf_path, "wb") as f:
        writer.write(f)


if __name__ == "__main__":
    main()
