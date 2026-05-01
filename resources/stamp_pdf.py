#!/usr/bin/env python3
# resources/stamp_pdf.py
# 用 reportlab 生成归档章叠加层，用 PyPDF2 合并到原 PDF
# 用法: python stamp_pdf.py <input.pdf> <output.pdf> <config.json_path> <schema.json_path>

import sys
import json
import os
from pathlib import Path

def stamp_pdf(input_path, output_path, config_json, schema_json):
    """主函数：为单个 PDF 加盖归档章"""
    config = json.loads(config_json)
    schema = json.loads(schema_json)

    # ── 1. 准备中文字体 ──────────────────────────────────────
    font_path = None
    for cand in [
        "C:/Windows/Fonts/simfang.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        "C:/Windows/Fonts/msyh.ttc",
    ]:
        if os.path.exists(cand):
            font_path = cand
            break

    # ── 2. 用 reportlab 生成归档章叠加 PDF ──────────────────
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.pagesizes import A4

    if font_path:
        font_name = "CnFont"
        pdfmetrics.registerFont(TTFont(font_name, font_path))
    else:
        font_name = "Helvetica"
        print("WARNING: 未找到中文字体，使用 Helvetica", file=sys.stderr)

    # 从 schema 读取尺寸
    sw_mm = schema.get("stamp_size_mm", [80, 30])
    sw = sw_mm[0] * mm
    sh = sw_mm[1] * mm
    rows = schema.get("grid", {}).get("rows", 3)
    cols = schema.get("grid", {}).get("cols", 2)
    cells = schema.get("cells", [])

    page_w, page_h = A4

    # 章位置（右上角，PDF 原点在左下角）
    margin = 10 * mm
    stamp_x = page_w - sw - margin
    stamp_y = page_h - sh - margin

    # 叠加层临时文件（与输出同目录）
    out_dir = os.path.dirname(output_path) or "."
    overlay_path = os.path.join(out_dir, "__overlay__.pdf")

    c = rl_canvas.Canvas(overlay_path, pagesize=A4)

    # 外边框
    c.rect(stamp_x, stamp_y, sw, sh, stroke=1, fill=0)

    # 内部竖线
    cell_w = sw / cols
    for col in range(1, cols):
        x = stamp_x + col * cell_w
        c.line(x, stamp_y, x, stamp_y + sh)

    # 内部横线
    cell_h = sh / rows
    for row in range(1, rows):
        y = stamp_y + row * cell_h
        c.line(stamp_x, y, stamp_x + sw, y)

    # 填入文字
    font_size_pt = 7
    c.setFont(font_name, font_size_pt)
    for cell in cells:
        row = cell.get("row", 0)
        col = cell.get("col", 0)
        label = cell.get("label", "")
        source = cell.get("source", "config")

        # 取值
        value = ""
        if source == "config":
            if label == "全宗号":
                value = config.get("fonds_code") or ""
            elif label == "年度":
                value = config.get("year") or ""
            elif label == "保管期限":
                value = config.get("retention") or ""

        text = f"{label}: {value}" if value else label

        # 单元格左上角偏移（PDF 坐标：y 向上）
        tx = stamp_x + col * cell_w + 2 * mm
        ty = stamp_y + sh - (row + 1) * cell_h + cell_h * 0.25
        c.drawString(tx, ty, text)

    c.save()

    # ── 3. 用 PyPDF2 / pypdf 合并叠加层到原 PDF 第1页 ────
    try:
        from PyPDF2 import PdfReader, PdfWriter
    except ImportError:
        from pypdf import PdfReader, PdfWriter

    reader = PdfReader(input_path)
    overlay_reader = PdfReader(overlay_path)

    writer = PdfWriter()
    for i, page in enumerate(reader.pages):
        if i == 0:
            page.merge_page(overlay_reader.pages[0])
        writer.add_page(page)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "wb") as f:
        writer.write(f)

    # 清理叠加文件
    try:
        os.remove(overlay_path)
    except OSError:
        pass

    return output_path


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("用法: python stamp_pdf.py <input> <output> <config.json> <schema.json>",
              file=sys.stderr)
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    config_json_path = sys.argv[3]
    schema_json_path = sys.argv[4]

    # 读取 JSON 文件
    with open(config_json_path, encoding="utf-8") as f:
        cfg = f.read()
    with open(schema_json_path, encoding="utf-8") as f:
        sch = f.read()

    try:
        result = stamp_pdf(input_pdf, output_pdf, cfg, sch)
        print(result)   # stdout 返回输出路径
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
