#!/usr/bin/env python3
"""
Trình tạo bộ 18 slide giới thiệu phần mềm SeedGW (Demo nội bộ 27/11/2026).

Bản cập nhật ngày 25/11/2026 (đồng bộ bối cảnh DMS-CRM cũ & mã nguồn mới nhất):
- Bám sát bối cảnh: thay thế từng giai đoạn hệ thống DMS-CRM cũ (FPT đã dừng hợp tác & hỗ trợ),
  giải quyết ổn định app, cự ly công tác phí (CTP), dashboard thực thời, dữ liệu sạch và hỗ trợ chủ động ĐMST&CĐS.
- Đồng bộ đầy đủ mã nguồn tới 25/11/2026: M12 (App tinh gọn 3 tab), S1 (Khách hàng nông dân/HTX),
  K8 (bộ lọc Từ ngày - Đến ngày), M10b (duyệt 1 bước đại lý mới), A2b/A2c (máy mới & mật khẩu),
  D3/D4 (Hub, Ctrl+K, Trung tâm thông báo), D5 (chia bảng GPS 6,48 triệu điểm), D6 (OWASP & 46 quyền / 17 model),
  D7 (responsive 27 trang & chữ to app), D8 (sổ đồng ý SHA-256 Luật BVDLCN), F8 (worker hàng đợi), F9 (tự ghi lỗi nội bộ).
- Phong cách công nghệ hiện đại chuẩn nhận diện Vinaseed (BRAND.md): xanh #005b36, xanh công nghệ #002b1a,
  trắng, nhấn #e8b909, #789a3d, #b33131, font UTM Neo Sans Intel (400 & 700), không ký tự cấm.
- Tích hợp sẵn hiệu ứng chuyển slide (Transitions) và hiệu ứng xuất hiện tuần tự mượt mà (Animations) chuẩn OOXML.

Cách chạy:
    python docs/slides/build_seedgw_demo_slides.py
"""

from __future__ import annotations

import io
import re
import sys
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from pathlib import Path
from typing import Sequence

try:
    from PIL import Image, ImageChops, ImageDraw
    from pptx import Presentation
    from pptx.chart.data import CategoryChartData
    from pptx.dml.color import RGBColor
    from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
    from pptx.enum.dml import MSO_LINE_DASH_STYLE
    from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.oxml.ns import qn
    from pptx.oxml.xmlchemy import OxmlElement
    from pptx.util import Inches, Pt
except ImportError as exc:
    print(
        "Thieu thu vien Python. Hay cai dat bang lenh:\n"
        "    pip install python-pptx Pillow\n"
        f"Chi tiet loi: {exc}",
        file=sys.stderr,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# Cấu hình thương hiệu SeedGW / Vinaseed (BRAND.md & phong cách công nghệ)
# ---------------------------------------------------------------------------

FONT_NAME = "UTM Neo Sans Intel"
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)
TOTAL_SLIDES = 18

# Bảng màu chính thức từ .design/seedgw/brand/tokens.css + tầng nền xanh công nghệ
C_BRAND = RGBColor(0x00, 0x5B, 0x36)        # --vs-green
C_BRAND_DARK = RGBColor(0x00, 0x51, 0x2D)   # --vs-green-dark
C_BRAND_DEEP = RGBColor(0x00, 0x3D, 0x22)   # nền thẻ tối trên slide dark-tech
C_TECH_BG = RGBColor(0x00, 0x2B, 0x1A)      # nền chủ đạo dark-tech (bìa, kiến trúc, kết)
C_TECH_PANEL = RGBColor(0x05, 0x3A, 0x25)   # mảng phụ dark-tech
C_TECH_GRID = RGBColor(0x0E, 0x4D, 0x34)    # lưới công nghệ tinh tế trên nền tối
C_TECH_MINT = RGBColor(0x52, 0xD1, 0x96)    # điểm nhấn sáng trên nền tối (tương phản > 7.5:1)
C_TECH_CANVAS = RGBColor(0xF6, 0xFA, 0xF8)  # nền sáng công nghệ dịu mắt cho slide nội dung
C_BRAND_90 = RGBColor(0x1A, 0x6B, 0x4A)
C_BRAND_80 = RGBColor(0x33, 0x7C, 0x5E)
C_BRAND_60 = RGBColor(0x66, 0x9D, 0x86)
C_BRAND_40 = RGBColor(0x99, 0xBD, 0xAF)
C_BRAND_30 = RGBColor(0xB3, 0xCE, 0xC3)
C_BRAND_20 = RGBColor(0xCC, 0xDE, 0xD7)
C_BRAND_10 = RGBColor(0xE6, 0xEF, 0xEB)     # --brand-soft
C_BRAND_05 = RGBColor(0xF1, 0xF7, 0xF4)     # nền thẻ nhẹ
C_OLIVE = RGBColor(0x78, 0x9A, 0x3D)        # --chart-2
C_YELLOW = RGBColor(0xE8, 0xB9, 0x09)       # --warning
C_YELLOW_SOFT = RGBColor(0xFC, 0xF4, 0xD3)  # --warning-soft
C_RED = RGBColor(0xB3, 0x31, 0x31)          # --danger
C_RED_SOFT = RGBColor(0xF7, 0xE6, 0xE6)     # --danger-soft
C_WHITE = RGBColor(0xFF, 0xFF, 0xFF)
C_BLACK = RGBColor(0x00, 0x00, 0x00)
C_TEXT_MUTED = RGBColor(0x58, 0x59, 0x5B)   # --vs-gray-80 (7.01:1 trên trắng)
C_BORDER = RGBColor(0xD1, 0xD3, 0xD4)       # --vs-gray-20
C_BORDER_TECH = RGBColor(0xC9, 0xDB, 0xD3)  # viền mảnh sắc nét hơi xanh công nghệ
C_SURFACE_SUBTLE = RGBColor(0xF1, 0xF2, 0xF2)

# Ký tự bị cấm theo BRAND.md §2 và scripts/check-glyphs.mjs (cộng dấu | lỗi nét)
FORBIDDEN_GLYPHS_RE = re.compile(r"[₫–—•·×→≤≥°«»\u00a0|]")

LANCZOS = getattr(Image, "Resampling", Image).LANCZOS


# ---------------------------------------------------------------------------
# Bộ rasterizer SVG -> PNG thuần Pillow (3x supersampling + even-odd fill)
# Đọc trực tiếp file SVG logo chuẩn Vinaseed trong .design/seedgw/brand/logo/
# ---------------------------------------------------------------------------

def _hex_to_rgb(color_str: str) -> tuple[int, int, int]:
    h = color_str.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _parse_svg_path(
    d: str,
    vx: float,
    vy: float,
    vw: float,
    vh: float,
    width: int,
    height: int,
    bezier_steps: int = 20,
) -> list[list[tuple[float, float]]]:
    """Chuyển chuỗi path SVG (M/L/H/V/C/Z) thành các đa giác ở toạ độ ảnh."""
    tokens = re.findall(r"[MLHVCZmlhvcz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    sx = width / vw
    sy = height / vh

    def to_px(x: float, y: float) -> tuple[float, float]:
        return (round((x - vx) * sx, 2), round((y - vy) * sy, 2))

    subpaths: list[list[tuple[float, float]]] = []
    poly: list[tuple[float, float]] = []
    cx = cy = 0.0
    start_x = start_y = 0.0
    idx = 0
    n = len(tokens)
    cmd = ""

    def is_num(pos: int) -> bool:
        return pos < n and tokens[pos][0] not in "MLHVCZmlhvcz"

    while idx < n:
        if not is_num(idx):
            cmd = tokens[idx]
            idx += 1

        if cmd in ("M", "m"):
            if len(poly) >= 3:
                subpaths.append(poly)
            poly = []
            x = float(tokens[idx])
            y = float(tokens[idx + 1])
            idx += 2
            if cmd == "m":
                x += cx
                y += cy
            cx, cy = x, y
            start_x, start_y = x, y
            poly.append(to_px(cx, cy))
            implicit_cmd = "L" if cmd == "M" else "l"
            while is_num(idx):
                nx = float(tokens[idx])
                ny = float(tokens[idx + 1])
                idx += 2
                if implicit_cmd == "l":
                    nx += cx
                    ny += cy
                cx, cy = nx, ny
                poly.append(to_px(cx, cy))
            cmd = implicit_cmd

        elif cmd in ("L", "l"):
            while is_num(idx):
                nx = float(tokens[idx])
                ny = float(tokens[idx + 1])
                idx += 2
                if cmd == "l":
                    nx += cx
                    ny += cy
                cx, cy = nx, ny
                poly.append(to_px(cx, cy))

        elif cmd in ("H", "h"):
            while is_num(idx):
                nx = float(tokens[idx])
                idx += 1
                cx = cx + nx if cmd == "h" else nx
                poly.append(to_px(cx, cy))

        elif cmd in ("V", "v"):
            while is_num(idx):
                ny = float(tokens[idx])
                idx += 1
                cy = cy + ny if cmd == "v" else ny
                poly.append(to_px(cx, cy))

        elif cmd in ("C", "c"):
            while is_num(idx):
                x1 = float(tokens[idx])
                y1 = float(tokens[idx + 1])
                x2 = float(tokens[idx + 2])
                y2 = float(tokens[idx + 3])
                x3 = float(tokens[idx + 4])
                y3 = float(tokens[idx + 5])
                idx += 6
                if cmd == "c":
                    x1 += cx
                    y1 += cy
                    x2 += cx
                    y2 += cy
                    x3 += cx
                    y3 += cy
                x0, y0 = cx, cy
                for step in range(1, bezier_steps + 1):
                    t = step / bezier_steps
                    mt = 1.0 - t
                    bx = (
                        mt * mt * mt * x0
                        + 3 * mt * mt * t * x1
                        + 3 * mt * t * t * x2
                        + t * t * t * x3
                    )
                    by = (
                        mt * mt * mt * y0
                        + 3 * mt * mt * t * y1
                        + 3 * mt * t * t * y2
                        + t * t * t * y3
                    )
                    poly.append(to_px(bx, by))
                cx, cy = x3, y3

        elif cmd in ("Z", "z"):
            if len(poly) >= 3:
                subpaths.append(poly)
            poly = []
            cx, cy = start_x, start_y

        else:
            raise ValueError(f"Lenh SVG khong ho tro: {cmd}")

    if len(poly) >= 3:
        subpaths.append(poly)
    return subpaths


def render_svg_to_png_bytes(svg_path: Path, target_width_px: int = 1000, scale: int = 3) -> tuple[bytes, float]:
    """Render file SVG phẳng (logo Vinaseed) thành PNG nền trong suốt sắc nét."""
    tree = ET.parse(svg_path)
    root = tree.getroot()
    vb_parts = [float(v) for v in root.attrib["viewBox"].replace(",", " ").split()]
    vx, vy, vw, vh = vb_parts
    aspect = vw / vh
    target_h = max(1, int(round(target_width_px / aspect)))
    w_hi = target_width_px * scale
    h_hi = target_h * scale

    color_masks: dict[tuple[int, int, int], Image.Image] = {}
    color_order: list[tuple[int, int, int]] = []

    def walk(elem: ET.Element, inherited_fill: str | None) -> None:
        tag = elem.tag.split("}")[-1]
        fill = elem.attrib.get("fill", inherited_fill)
        if tag == "path" and fill and fill.lower() != "none":
            rgb = _hex_to_rgb(fill)
            subpaths = _parse_svg_path(elem.attrib["d"], vx, vy, vw, vh, w_hi, h_hi)
            if subpaths:
                path_mask = Image.new("L", (w_hi, h_hi), 0)
                for poly in subpaths:
                    sub_mask = Image.new("L", (w_hi, h_hi), 0)
                    ImageDraw.Draw(sub_mask).polygon(poly, fill=255)
                    path_mask = ImageChops.difference(path_mask, sub_mask)
                if rgb not in color_masks:
                    color_masks[rgb] = path_mask
                    color_order.append(rgb)
                else:
                    color_masks[rgb] = ImageChops.lighter(color_masks[rgb], path_mask)
        for child in elem:
            walk(child, fill)

    walk(root, None)
    canvas = Image.new("RGBA", (w_hi, h_hi), (0, 0, 0, 0))
    for rgb in color_order:
        r, g, b = rgb
        layer = Image.new("RGBA", (w_hi, h_hi), (r, g, b, 0))
        layer.putalpha(color_masks[rgb])
        canvas.alpha_composite(layer)

    final_img = canvas.resize((target_width_px, target_h), LANCZOS)
    buf = io.BytesIO()
    final_img.save(buf, format="PNG", optimize=True)
    return buf.getvalue(), aspect


class BrandAssets:
    """Tải và cache bộ logo chính thức của Vinaseed từ repo."""

    def __init__(self, repo_root: Path) -> None:
        logo_dir = repo_root / ".design" / "seedgw" / "brand" / "logo"
        required = {
            "color": logo_dir / "vinaseed-logo-color.svg",
            "white": logo_dir / "vinaseed-logo-white.svg",
            "symbol_green": logo_dir / "vinaseed-symbol-green.svg",
            "symbol_white": logo_dir / "vinaseed-symbol-white.svg",
        }
        missing = [str(p) for p in required.values() if not p.is_file()]
        if missing:
            raise FileNotFoundError(
                "Khong tim thay file logo Vinaseed trong repo:\n  " + "\n  ".join(missing)
            )
        self.logo_color, self.logo_aspect = render_svg_to_png_bytes(required["color"], 1000, 3)
        self.logo_white, _ = render_svg_to_png_bytes(required["white"], 1000, 3)
        self.symbol_green, self.symbol_aspect = render_svg_to_png_bytes(required["symbol_green"], 500, 3)
        self.symbol_white, _ = render_svg_to_png_bytes(required["symbol_white"], 500, 3)

        # Bộ ảnh chụp màn hình thật từ App iPhone & Web bản chạy thử (docs/slides/assets/)
        assets_dir = repo_root / "docs" / "slides" / "assets"
        self.screenshots: dict[str, tuple[Path, float]] = {}
        for key, filename in {
            "app_today": "app-today.jpg",
            "app_history": "app-history.jpg",
            "app_me": "app-me.jpg",
            "web_checkin_map": "web-checkin-map.jpg",
            "web_dashboard": "web-dashboard.png",
            "web_executive": "web-executive.jpg",
        }.items():
            img_path = assets_dir / filename
            if img_path.is_file():
                with Image.open(img_path) as im:
                    w, h = im.size
                self.screenshots[key] = (img_path, w / h)

    def has_screenshot(self, key: str) -> bool:
        return key in self.screenshots

    def add_phone_screenshot(
        self,
        slide,
        key: str,
        left_in: float,
        top_in: float,
        screen_h: float,
        caption: str,
        caption_bg: RGBColor = C_BRAND_10,
        caption_fg: RGBColor = C_BRAND,
    ) -> float:
        """Đóng khung điện thoại bo tối chứa ảnh chụp thật đúng tỉ lệ gốc, trả về chiều rộng khung."""
        img_path, aspect = self.screenshots[key]
        screen_w = screen_h * aspect
        pad_x = 0.075
        pad_top = 0.085
        pad_bot = 0.085
        frame_w = screen_w + 2 * pad_x
        frame_h = screen_h + pad_top + pad_bot
        add_rect(
            slide, left_in, top_in, frame_w, frame_h,
            fill_color=RGBColor(0x14, 0x20, 0x1B),
            line_color=C_BRAND_80, line_pt=1.1,
            rounded=True, radius=0.09,
        )
        slide.shapes.add_picture(
            str(img_path),
            Inches(left_in + pad_x),
            Inches(top_in + pad_top),
            width=Inches(screen_w),
            height=Inches(screen_h),
        )
        add_pill(
            slide,
            left_in,
            top_in + frame_h + 0.10,
            frame_w,
            0.27,
            caption,
            bg_color=caption_bg,
            text_color=caption_fg,
            size_pt=8.3,
            bold=True,
            line_color=C_BRAND_20 if caption_bg == C_BRAND_10 else None,
        )
        return frame_w

    def add_browser_screenshot(
        self,
        slide,
        key: str,
        left_in: float,
        top_in: float,
        frame_w: float,
        url_text: str,
        badge_text: str = "ẢNH THẬT",
    ) -> float:
        """Đóng khung trình duyệt công nghệ chứa ảnh chụp thật đúng tỉ lệ gốc, trả về tổng chiều cao."""
        img_path, aspect = self.screenshots[key]
        pad = 0.05
        bar_h = 0.30
        img_w = frame_w - 2 * pad
        img_h = img_w / aspect
        total_h = bar_h + img_h + 2 * pad

        add_rect(
            slide, left_in, top_in, frame_w, total_h,
            fill_color=C_WHITE, line_color=C_BRAND_60, line_pt=1.1,
            rounded=True, radius=0.04,
        )
        add_card_header(slide, left_in, top_in, frame_w, bar_h, total_h, 0.04, fill_color=C_TECH_BG)
        add_oval(slide, left_in + 0.12, top_in + 0.10, 0.095, 0.095, fill_color=C_RED)
        add_oval(slide, left_in + 0.25, top_in + 0.10, 0.095, 0.095, fill_color=C_YELLOW)
        add_oval(slide, left_in + 0.38, top_in + 0.10, 0.095, 0.095, fill_color=C_TECH_MINT)

        badge_w = 0.96 if badge_text else 0.0
        url_w = frame_w - 0.62 - badge_w - (0.14 if badge_text else 0.08)
        add_rect(
            slide, left_in + 0.56, top_in + 0.055, url_w, 0.19,
            fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=0.5,
            rounded=True, radius=0.25,
        )
        add_textbox(
            slide, left_in + 0.64, top_in + 0.055, url_w - 0.14, 0.19,
            url_text, size_pt=7.5, color=C_BRAND_20, valign=MSO_ANCHOR.MIDDLE,
        )
        if badge_text:
            add_pill(
                slide, left_in + frame_w - badge_w - 0.08, top_in + 0.055, badge_w, 0.19,
                badge_text, bg_color=C_YELLOW, text_color=C_BLACK, size_pt=7.0, bold=True,
            )

        slide.shapes.add_picture(
            str(img_path),
            Inches(left_in + pad),
            Inches(top_in + bar_h + pad),
            width=Inches(img_w),
            height=Inches(img_h),
        )
        return total_h

    def add_logo(self, slide, variant: str, left_in: float, top_in: float, width_in: float):
        data = self.logo_white if variant == "white" else self.logo_color
        height_in = width_in / self.logo_aspect
        return slide.shapes.add_picture(
            io.BytesIO(data),
            Inches(left_in),
            Inches(top_in),
            width=Inches(width_in),
            height=Inches(height_in),
        )

    def add_symbol(self, slide, variant: str, left_in: float, top_in: float, width_in: float):
        data = self.symbol_white if variant == "white" else self.symbol_green
        height_in = width_in / self.symbol_aspect
        return slide.shapes.add_picture(
            io.BytesIO(data),
            Inches(left_in),
            Inches(top_in),
            width=Inches(width_in),
            height=Inches(height_in),
        )


# ---------------------------------------------------------------------------
# Động cơ Transitions & Animations chuẩn OOXML (tương thích PowerPoint 2016-365)
# ---------------------------------------------------------------------------

def _insert_slide_child_in_order(sld_elem, child_elem, after_tags: tuple[str, ...]) -> None:
    """Chèn thẻ con vào <p:sld> đúng thứ tự schema ECMA-376: cSld -> clrMapOvr -> transition -> timing -> extLst."""
    tag_name = child_elem.tag
    for old in list(sld_elem.findall(tag_name)):
        sld_elem.remove(old)

    insert_idx = 0
    for idx, existing in enumerate(list(sld_elem)):
        local = existing.tag.split("}")[-1]
        if local in after_tags:
            insert_idx = idx + 1
    sld_elem.insert(insert_idx, child_elem)


def add_slide_transition(slide, kind: str = "fade", speed: str = "fast") -> None:
    """Gắn hiệu ứng chuyển slide chuẩn OOXML (fade, push, wipe, cover)."""
    tr = OxmlElement("p:transition")
    tr.set("spd", speed)
    tr.set("advClick", "1")
    if kind == "push":
        eff = OxmlElement("p:push")
        eff.set("dir", "l")
    elif kind == "wipe":
        eff = OxmlElement("p:wipe")
        eff.set("dir", "l")
    elif kind == "cover":
        eff = OxmlElement("p:cover")
        eff.set("dir", "l")
    else:
        eff = OxmlElement("p:fade")
        eff.set("thruBlk", "0")
    tr.append(eff)
    _insert_slide_child_in_order(slide._element, tr, ("cSld", "clrMapOvr"))


class SlideAnimator:
    """
    Gom nhóm các shape theo từng nhịp xuất hiện (wave) và sinh thẻ <p:timing> chuẩn OOXML.
    Mọi hiệu ứng tự chạy mượt ngay khi vào slide (Start With Previous + độ trễ bậc thang),
    người trình chiếu không phải bấm chuột nhiều lần trên mỗi slide.
    """

    def __init__(self, slide) -> None:
        self.slide = slide
        self._items: list[tuple[int, int, int, str]] = []  # (spid, delay_ms, dur_ms, effect)

    @contextmanager
    def wave(self, delay_ms: int, dur_ms: int = 340, effect: str = "fade"):
        before = len(self.slide.shapes)
        yield
        for shape in list(self.slide.shapes)[before:]:
            self._items.append((shape.shape_id, delay_ms, dur_ms, effect))

    def apply(self) -> None:
        if not self._items:
            return

        # Giữ duy nhất mỗi spid theo thứ tự thêm vào
        seen: set[int] = set()
        entries: list[tuple[int, int, int, str]] = []
        for spid, delay_ms, dur_ms, effect in self._items:
            if spid not in seen:
                seen.add(spid)
                entries.append((spid, delay_ms, dur_ms, effect))

        timing = OxmlElement("p:timing")
        tn_lst = OxmlElement("p:tnLst")
        timing.append(tn_lst)

        root_par = OxmlElement("p:par")
        tn_lst.append(root_par)
        root_ctn = OxmlElement("p:cTn")
        root_ctn.set("id", "1")
        root_ctn.set("dur", "indefinite")
        root_ctn.set("restart", "never")
        root_ctn.set("nodeType", "tmRoot")
        root_par.append(root_ctn)

        root_children = OxmlElement("p:childTnLst")
        root_ctn.append(root_children)

        seq = OxmlElement("p:seq")
        seq.set("concurrent", "1")
        seq.set("nextAc", "seek")
        root_children.append(seq)

        seq_ctn = OxmlElement("p:cTn")
        seq_ctn.set("id", "2")
        seq_ctn.set("dur", "indefinite")
        seq_ctn.set("nodeType", "mainSeq")
        seq.append(seq_ctn)

        seq_children = OxmlElement("p:childTnLst")
        seq_ctn.append(seq_children)

        # Nhóm kích hoạt tự động khi mở slide (delay="0" thay vì indefinite)
        trig_par = OxmlElement("p:par")
        seq_children.append(trig_par)
        trig_ctn = OxmlElement("p:cTn")
        trig_ctn.set("id", "3")
        trig_ctn.set("fill", "hold")
        trig_par.append(trig_ctn)

        trig_st = OxmlElement("p:stCondLst")
        trig_cond = OxmlElement("p:cond")
        trig_cond.set("delay", "0")
        trig_st.append(trig_cond)
        trig_ctn.append(trig_st)

        trig_children = OxmlElement("p:childTnLst")
        trig_ctn.append(trig_children)

        group_par = OxmlElement("p:par")
        trig_children.append(group_par)
        group_ctn = OxmlElement("p:cTn")
        group_ctn.set("id", "4")
        group_ctn.set("fill", "hold")
        group_par.append(group_ctn)

        grp_st = OxmlElement("p:stCondLst")
        grp_cond = OxmlElement("p:cond")
        grp_cond.set("delay", "0")
        grp_st.append(grp_cond)
        group_ctn.append(grp_st)

        grp_children = OxmlElement("p:childTnLst")
        group_ctn.append(grp_children)

        next_id = 5
        for spid, delay_ms, dur_ms, effect in entries:
            eff_par = OxmlElement("p:par")
            grp_children.append(eff_par)

            eff_ctn = OxmlElement("p:cTn")
            eff_ctn.set("id", str(next_id))
            next_id += 1
            if effect == "wipe_right":
                eff_ctn.set("presetID", "22")
                eff_ctn.set("presetSubtype", "8")
                filter_val = "wipe(right)"
            elif effect == "wipe_up":
                eff_ctn.set("presetID", "22")
                eff_ctn.set("presetSubtype", "4")
                filter_val = "wipe(down)"
            else:
                eff_ctn.set("presetID", "10")
                eff_ctn.set("presetSubtype", "0")
                filter_val = "fade"
            eff_ctn.set("presetClass", "entr")
            eff_ctn.set("fill", "hold")
            eff_ctn.set("grpId", "0")
            eff_ctn.set("nodeType", "withEffect")
            eff_par.append(eff_ctn)

            st_lst = OxmlElement("p:stCondLst")
            cond = OxmlElement("p:cond")
            cond.set("delay", str(delay_ms))
            st_lst.append(cond)
            eff_ctn.append(st_lst)

            eff_children = OxmlElement("p:childTnLst")
            eff_ctn.append(eff_children)

            # 1. Chuyển visibility sang visible tại thời điểm bắt đầu hiệu ứng
            p_set = OxmlElement("p:set")
            eff_children.append(p_set)
            set_bhvr = OxmlElement("p:cBhvr")
            p_set.append(set_bhvr)
            set_ctn = OxmlElement("p:cTn")
            set_ctn.set("id", str(next_id))
            next_id += 1
            set_ctn.set("dur", "1")
            set_ctn.set("fill", "hold")
            set_st = OxmlElement("p:stCondLst")
            set_c = OxmlElement("p:cond")
            set_c.set("delay", "0")
            set_st.append(set_c)
            set_ctn.append(set_st)
            set_bhvr.append(set_ctn)

            tgt1 = OxmlElement("p:tgtEl")
            sp_tgt1 = OxmlElement("p:spTgt")
            sp_tgt1.set("spid", str(spid))
            tgt1.append(sp_tgt1)
            set_bhvr.append(tgt1)

            attr_lst = OxmlElement("p:attrNameLst")
            attr_name = OxmlElement("p:attrName")
            attr_name.text = "style.visibility"
            attr_lst.append(attr_name)
            set_bhvr.append(attr_lst)

            p_to = OxmlElement("p:to")
            str_val = OxmlElement("p:strVal")
            str_val.set("val", "visible")
            p_to.append(str_val)
            p_set.append(p_to)

            # 2. Hiệu ứng chuyển mượt (fade / wipe)
            anim_eff = OxmlElement("p:animEffect")
            anim_eff.set("transition", "in")
            anim_eff.set("filter", filter_val)
            eff_children.append(anim_eff)

            ae_bhvr = OxmlElement("p:cBhvr")
            anim_eff.append(ae_bhvr)
            ae_ctn = OxmlElement("p:cTn")
            ae_ctn.set("id", str(next_id))
            next_id += 1
            ae_ctn.set("dur", str(dur_ms))
            ae_bhvr.append(ae_ctn)

            tgt2 = OxmlElement("p:tgtEl")
            sp_tgt2 = OxmlElement("p:spTgt")
            sp_tgt2.set("spid", str(spid))
            tgt2.append(sp_tgt2)
            ae_bhvr.append(tgt2)

        # Điều kiện tiến/lùi tiêu chuẩn của PowerPoint MainSequence
        prev_lst = OxmlElement("p:prevCondLst")
        prev_c = OxmlElement("p:cond")
        prev_c.set("evt", "onPrev")
        prev_c.set("delay", "0")
        prev_tgt = OxmlElement("p:tgtEl")
        prev_tgt.append(OxmlElement("p:sldTgt"))
        prev_c.append(prev_tgt)
        prev_lst.append(prev_c)
        seq.append(prev_lst)

        next_lst = OxmlElement("p:nextCondLst")
        next_c = OxmlElement("p:cond")
        next_c.set("evt", "onNext")
        next_c.set("delay", "0")
        next_tgt = OxmlElement("p:tgtEl")
        next_tgt.append(OxmlElement("p:sldTgt"))
        next_c.append(next_tgt)
        next_lst.append(next_c)
        seq.append(next_lst)

        # Danh sách build (bldLst)
        bld_lst = OxmlElement("p:bldLst")
        for spid, _, _, _ in entries:
            bld_p = OxmlElement("p:bldP")
            bld_p.set("spid", str(spid))
            bld_p.set("grpId", "0")
            bld_lst.append(bld_p)
        timing.append(bld_lst)

        _insert_slide_child_in_order(self.slide._element, timing, ("cSld", "clrMapOvr", "transition"))


# ---------------------------------------------------------------------------
# Tiện ích vẽ PowerPoint phong cách công nghệ sắc nét
# ---------------------------------------------------------------------------

def set_slide_bg(slide, color: RGBColor) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_rect(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    fill_color: RGBColor | None = None,
    line_color: RGBColor | None = None,
    line_pt: float = 1.0,
    rounded: bool = False,
    radius: float = 0.08,
):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(
        shape_type, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    shape.shadow.inherit = False
    if rounded and len(shape.adjustments) > 0:
        shape.adjustments[0] = radius
    if fill_color is not None:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill_color
    else:
        shape.fill.background()
    if line_color is not None:
        shape.line.color.rgb = line_color
        shape.line.width = Pt(line_pt)
    else:
        shape.line.fill.background()
    return shape


def add_card_header(
    slide,
    left: float,
    top: float,
    width: float,
    bar_height: float,
    card_height: float,
    card_radius: float,
    fill_color: RGBColor,
):
    """Vẽ thanh tiêu đề bo đúng 2 góc trên khớp bán kính với thẻ bo góc bên dưới."""
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUND_2_SAME_RECTANGLE,
        Inches(left), Inches(top), Inches(width), Inches(bar_height),
    )
    shape.shadow.inherit = False
    corner_in = card_radius * min(width, card_height)
    adj_top = min(0.5, corner_in / min(width, bar_height))
    if len(shape.adjustments) >= 2:
        shape.adjustments[0] = adj_top
        shape.adjustments[1] = 0.0
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.fill.background()
    return shape


def add_card_top_accent(
    slide,
    left: float,
    top: float,
    width: float,
    card_height: float,
    card_radius: float,
    fill_color: RGBColor,
    bar_height: float = 0.065,
):
    """Vẽ dải nhấn mảnh ở mép trên thẻ bo góc, thụt gọn trong cạnh thẳng để không lộ góc."""
    corner_in = card_radius * min(width, card_height)
    inset = max(0.11, corner_in + 0.025)
    return add_rect(
        slide,
        left + inset,
        top + 0.015,
        width - 2 * inset,
        bar_height,
        fill_color=fill_color,
        rounded=True,
        radius=0.5,
    )


def add_oval(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    fill_color: RGBColor,
    line_color: RGBColor | None = None,
    line_pt: float = 1.0,
):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.OVAL, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    shape.shadow.inherit = False
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if line_color is not None:
        shape.line.color.rgb = line_color
        shape.line.width = Pt(line_pt)
    else:
        shape.line.fill.background()
    return shape


def add_arrow_right(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    fill_color: RGBColor = C_BRAND_40,
):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RIGHT_ARROW, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    shape.shadow.inherit = False
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.fill.background()
    return shape


def add_tech_grid_bg(slide, left: float, top: float, width: float, height: float, cols: int = 8, rows: int = 5) -> None:
    """Vẽ lưới đường mảnh công nghệ tinh tế trên nền dark-tech (không gây rối mắt)."""
    dx = width / cols
    dy = height / rows
    for c in range(1, cols):
        add_rect(slide, left + c * dx, top, 0.008, height, fill_color=C_TECH_GRID)
    for r in range(1, rows):
        add_rect(slide, left, top + r * dy, width, 0.008, fill_color=C_TECH_GRID)


def add_textbox(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    text: str = "",
    size_pt: float = 12.0,
    bold: bool = False,
    italic: bool = False,
    color: RGBColor = C_BLACK,
    align: PP_ALIGN = PP_ALIGN.LEFT,
    valign: MSO_ANCHOR = MSO_ANCHOR.TOP,
    line_spacing: float = 1.24,
    margin: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0),
):
    box = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = box.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.margin_left = Inches(margin[0])
    tf.margin_top = Inches(margin[1])
    tf.margin_right = Inches(margin[2])
    tf.margin_bottom = Inches(margin[3])
    if text:
        p = tf.paragraphs[0]
        p.alignment = align
        p.line_spacing = line_spacing
        run = p.add_run()
        run.text = text
        run.font.name = FONT_NAME
        run.font.size = Pt(size_pt)
        run.font.bold = bold
        run.font.italic = italic
        run.font.color.rgb = color
    return box


def add_rich_paragraphs(
    text_frame,
    items: Sequence[tuple[str, str]],
    title_pt: float = 11.0,
    body_pt: float = 10.5,
    title_color: RGBColor = C_BLACK,
    body_color: RGBColor = C_TEXT_MUTED,
    space_after_pt: float = 5.0,
    line_spacing: float = 1.20,
) -> None:
    """Thêm nhiều đoạn có đầu mục in đậm và nội dung thường trên cùng dòng."""
    for idx, (lead, body) in enumerate(items):
        p = text_frame.paragraphs[0] if idx == 0 else text_frame.add_paragraph()
        p.line_spacing = line_spacing
        p.space_after = Pt(space_after_pt if idx < len(items) - 1 else 0)
        if lead:
            r1 = p.add_run()
            r1.text = lead
            r1.font.name = FONT_NAME
            r1.font.size = Pt(title_pt)
            r1.font.bold = True
            r1.font.color.rgb = title_color
        if body:
            r2 = p.add_run()
            r2.text = body
            r2.font.name = FONT_NAME
            r2.font.size = Pt(body_pt)
            r2.font.bold = False
            r2.font.color.rgb = body_color


def add_bullet_lines(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    lines: Sequence[str],
    size_pt: float = 11.0,
    color: RGBColor = C_BLACK,
    dot_color: RGBColor = C_BRAND,
    step_y: float = 0.42,
    bold_prefix_sep: str | None = ":",
    lead_color: RGBColor | None = None,
) -> None:
    """Vẽ danh sách với chấm tròn vector (tránh ký tự bullet thiếu trong font)."""
    head_col = lead_color if lead_color is not None else C_BLACK
    for idx, line in enumerate(lines):
        y = top + idx * step_y
        add_oval(slide, left, y + 0.08, 0.095, 0.095, fill_color=dot_color)
        tb = add_textbox(slide, left + 0.19, y, width - 0.19, step_y, margin=(0, 0, 0, 0))
        p = tb.text_frame.paragraphs[0]
        p.line_spacing = 1.18
        if bold_prefix_sep and bold_prefix_sep in line:
            head, tail = line.split(bold_prefix_sep, 1)
            r1 = p.add_run()
            r1.text = head + bold_prefix_sep
            r1.font.name = FONT_NAME
            r1.font.size = Pt(size_pt)
            r1.font.bold = True
            r1.font.color.rgb = head_col
            r2 = p.add_run()
            r2.text = tail
            r2.font.name = FONT_NAME
            r2.font.size = Pt(size_pt)
            r2.font.bold = False
            r2.font.color.rgb = color
        else:
            r = p.add_run()
            r.text = line
            r.font.name = FONT_NAME
            r.font.size = Pt(size_pt)
            r.font.color.rgb = color


def add_pill(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    text: str,
    bg_color: RGBColor = C_BRAND_10,
    text_color: RGBColor = C_BRAND,
    size_pt: float = 9.5,
    bold: bool = True,
    line_color: RGBColor | None = None,
):
    shape = add_rect(
        slide, left, top, width, height, fill_color=bg_color, line_color=line_color,
        line_pt=0.8, rounded=True, radius=0.45
    )
    tf = shape.text_frame
    tf.word_wrap = False
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    tf.margin_top = Inches(0.01)
    tf.margin_bottom = Inches(0.01)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.name = FONT_NAME
    r.font.size = Pt(size_pt)
    r.font.bold = bold
    r.font.color.rgb = text_color
    return shape


def add_circle_badge(
    slide,
    left: float,
    top: float,
    diameter: float,
    label: str,
    bg_color: RGBColor = C_BRAND,
    text_color: RGBColor = C_WHITE,
    size_pt: float = 11.5,
):
    oval = add_oval(slide, left, top, diameter, diameter, fill_color=bg_color)
    tf = oval.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = Inches(0)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = label
    r.font.name = FONT_NAME
    r.font.size = Pt(size_pt)
    r.font.bold = True
    r.font.color.rgb = text_color
    return oval


def set_cell_borders(cell, hex_color: str = "C9DBD3", width_emu: int = 6350) -> None:
    """Đặt viền 4 cạnh ô bảng đúng thứ tự schema OOXML (trước solidFill)."""
    tcPr = cell._tc.get_or_add_tcPr()
    border_tags = ("a:lnL", "a:lnR", "a:lnT", "a:lnB")
    for tag in border_tags:
        for old in list(tcPr.findall(qn(tag))):
            tcPr.remove(old)
    for tag in reversed(border_tags):
        ln = OxmlElement(tag)
        ln.set("w", str(width_emu))
        ln.set("cap", "flat")
        ln.set("cmpd", "sng")
        ln.set("algn", "ctr")
        sf = OxmlElement("a:solidFill")
        clr = OxmlElement("a:srgbClr")
        clr.set("val", hex_color)
        sf.append(clr)
        ln.append(sf)
        prst = OxmlElement("a:prstDash")
        prst.set("val", "solid")
        ln.append(prst)
        tcPr.insert(0, ln)


def style_table_cell(
    cell,
    text: str,
    fill_color: RGBColor,
    text_color: RGBColor = C_BLACK,
    size_pt: float = 9.8,
    bold: bool = False,
    align: PP_ALIGN = PP_ALIGN.CENTER,
    border_hex: str = "C9DBD3",
) -> None:
    set_cell_borders(cell, hex_color=border_hex)
    cell.fill.solid()
    cell.fill.fore_color.rgb = fill_color
    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    cell.margin_left = Inches(0.08)
    cell.margin_right = Inches(0.08)
    cell.margin_top = Inches(0.03)
    cell.margin_bottom = Inches(0.03)
    tf = cell.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = 1.12
    r = p.add_run()
    r.text = text
    r.font.name = FONT_NAME
    r.font.size = Pt(size_pt)
    r.font.bold = bold
    r.font.color.rgb = text_color


def add_notes(slide, text: str) -> None:
    slide.notes_slide.notes_text_frame.text = text.strip()


def add_chrome(
    slide,
    assets: BrandAssets,
    slide_no: int,
    section_no: str,
    section_label: str,
    title: str,
    subtitle: str,
    dark: bool = False,
) -> None:
    """Khung công nghệ chuẩn cho các slide nội dung (hỗ trợ nền sáng và nền dark-tech)."""
    if dark:
        set_slide_bg(slide, C_TECH_BG)
        add_tech_grid_bg(slide, 0.0, 0.07, 13.333, 6.92, cols=12, rows=6)
    else:
        set_slide_bg(slide, C_TECH_CANVAS)

    # Thanh tiến độ công nghệ trên cùng (xanh chủ đạo + vạch vàng theo tiến độ bài)
    add_rect(slide, 0.0, 0.0, 13.333, 0.07, fill_color=C_BRAND_DARK if dark else C_BRAND)
    prog_w = round(13.333 * (slide_no / TOTAL_SLIDES), 3)
    add_rect(slide, 0.0, 0.0, prog_w, 0.07, fill_color=C_YELLOW if dark else C_TECH_MINT)

    # Chip chuyên mục kiểu công nghệ: ô số đậm + nhãn chữ
    add_rect(
        slide, 0.60, 0.23, 0.44, 0.27,
        fill_color=C_YELLOW if dark else C_BRAND, rounded=True, radius=0.30,
    )
    add_textbox(
        slide, 0.60, 0.23, 0.44, 0.27, section_no,
        size_pt=8.8, bold=True, color=C_BLACK if dark else C_WHITE,
        align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
    )
    tag_w = max(1.90, min(3.85, len(section_label) * 0.098 + 0.40))
    add_pill(
        slide, 1.10, 0.23, tag_w, 0.27, section_label.upper(),
        bg_color=C_TECH_PANEL if dark else C_BRAND_10,
        text_color=C_TECH_MINT if dark else C_BRAND,
        size_pt=8.8, bold=True,
        line_color=C_BRAND_90 if dark else C_BRAND_20,
    )

    # Logo Vinaseed góc trên phải (vùng an toàn >= width/18 = 0.092 in)
    assets.add_logo(slide, "white" if dark else "color", left_in=11.08, top_in=0.26, width_in=1.65)

    # Tiêu đề (tự điều chỉnh cỡ chữ để luôn nằm gọn 1 dòng, không bao giờ đè phụ đề)
    title_pt = 20.0 if len(title) > 68 else (21.5 if len(title) > 62 else 23.0)
    add_textbox(
        slide, 0.60, 0.56, 10.25, 0.46, title,
        size_pt=title_pt, bold=True, color=C_WHITE if dark else C_BRAND, valign=MSO_ANCHOR.MIDDLE,
    )
    add_textbox(
        slide, 0.60, 1.05, 12.13, 0.34, subtitle,
        size_pt=11.8, bold=False, color=C_BRAND_20 if dark else C_TEXT_MUTED,
    )

    # Đường phân cách công nghệ 2 tông dưới phần đầu
    add_rect(slide, 0.60, 1.46, 12.133, 0.016, fill_color=C_BRAND_90 if dark else C_BRAND_20)
    add_rect(slide, 0.60, 1.455, 1.65, 0.032, fill_color=C_YELLOW if dark else C_BRAND)

    # Chân trang thống nhất
    add_rect(slide, 0.60, 7.00, 12.133, 0.012, fill_color=C_BRAND_90 if dark else C_BORDER_TECH)
    add_oval(slide, 0.60, 7.15, 0.08, 0.08, fill_color=C_TECH_MINT if dark else C_BRAND)
    add_textbox(
        slide, 0.76, 7.08, 9.5, 0.26,
        "SeedGW  -  Giới thiệu phần mềm (Demo 27/11/2026)  -  Phòng ĐMST&CĐS",
        size_pt=9.2, color=C_BRAND_20 if dark else C_TEXT_MUTED, valign=MSO_ANCHOR.MIDDLE,
    )
    add_pill(
        slide, 11.88, 7.07, 0.85, 0.26, f"{slide_no:02d} / {TOTAL_SLIDES:02d}",
        bg_color=C_TECH_PANEL if dark else C_BRAND_10,
        text_color=C_YELLOW if dark else C_BRAND,
        size_pt=8.8, bold=True,
        line_color=C_BRAND_90 if dark else C_BRAND_20,
    )


def add_copyright_runs(paragraph, size_pt: float, color: RGBColor, prefix: str = "", prefix_color: RGBColor | None = None) -> None:
    """In dòng bản quyền với ký hiệu © phóng lớn gấp ~2x và hạ baseline chuẩn BRAND.md §2."""
    paragraph.line_spacing = Pt(size_pt + 4.0)
    parts: list[tuple[str, float, bool, RGBColor, str | None]] = []
    if prefix:
        parts.append((prefix, size_pt, True, prefix_color or color, None))
    parts.extend([
        ("Bản quyền ", size_pt, False, color, None),
        ("©", round(size_pt * 1.9, 1), False, color, "-24000"),
        (" 2026 thuộc Phòng ĐMST&CĐS", size_pt, False, color, None),
    ])
    for txt, sz, bld, col, base in parts:
        r = paragraph.add_run()
        r.text = txt
        r.font.name = FONT_NAME
        r.font.size = Pt(sz)
        r.font.bold = bld
        r.font.color.rgb = col
        if base is not None:
            r._r.get_or_add_rPr().set("baseline", base)


# ---------------------------------------------------------------------------
# 18 Slide chi tiết (Đồng bộ bối cảnh DMS-CRM cũ & toàn bộ mã nguồn 25/11/2026)
# ---------------------------------------------------------------------------

def build_slide_01_cover(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide, C_TECH_BG)
    add_slide_transition(slide, "fade", "med")
    anim = SlideAnimator(slide)

    # Nền lưới công nghệ bên trái & mảng khối xanh đậm bên phải
    add_tech_grid_bg(slide, 0.0, 0.0, 8.85, 7.5, cols=8, rows=6)
    add_rect(slide, 8.85, 0.0, 4.483, 7.5, fill_color=C_BRAND_DEEP)
    add_tech_grid_bg(slide, 8.85, 0.0, 4.483, 7.5, cols=4, rows=6)
    add_rect(slide, 8.85, 0.0, 0.06, 7.5, fill_color=C_YELLOW)
    # Thanh sáng nhấn đỉnh
    add_rect(slide, 0.0, 0.0, 13.333, 0.06, fill_color=C_TECH_MINT)

    # Logo trắng Vinaseed chuẩn (cỡ L/XL)
    assets.add_logo(slide, "white", left_in=0.72, top_in=0.62, width_in=2.55)

    with anim.wave(80, 360):
        # Hàng nhãn công nghệ trên bìa
        add_pill(
            slide, 0.72, 1.82, 2.75, 0.34,
            "DEMO NỘI BỘ  27/11/2026",
            bg_color=C_YELLOW, text_color=C_BLACK, size_pt=10.0, bold=True,
        )
        add_pill(
            slide, 3.60, 1.82, 2.20, 0.34,
            "WEB & APP v0.2.0",
            bg_color=C_TECH_PANEL, text_color=C_TECH_MINT, size_pt=9.5, bold=True, line_color=C_BRAND_90,
        )
        # Tên sản phẩm & thông điệp chính
        add_textbox(slide, 0.72, 2.34, 7.75, 1.00, "SeedGW", size_pt=54.0, bold=True, color=C_WHITE)
        add_textbox(
            slide, 0.72, 3.42, 7.75, 0.88,
            "Nền tảng quản lý thị trường ổn định, tự chủ cho Vinaseed",
            size_pt=22.0, bold=True, color=C_TECH_MINT, line_spacing=1.22,
        )
        add_textbox(
            slide, 0.72, 4.38, 7.65, 0.92,
            "Giải pháp thay thế từng giai đoạn hệ thống DMS-CRM cũ đã ngừng hỗ trợ: check-in tin cậy, đo cự ly công tác phí chính xác, dữ liệu sạch và điều hành trong ngày.",
            size_pt=13.0, color=C_BRAND_20, line_spacing=1.34,
        )

    with anim.wave(240, 380):
        # 3 thẻ tóm tắt năng lực kỹ thuật bên dưới thông điệp
        badges = [
            ("App tinh gọn 3 tab", "Offline-first, không quay tròn"),
            ("Sai số 0,3% - 1,8%", "Minh bạch cự ly công tác phí"),
            ("ĐMST&CĐS làm chủ", "Hỗ trợ chủ động, kịp thời"),
        ]
        for idx, (bh, bs) in enumerate(badges):
            bx = 0.72 + idx * 2.58
            add_rect(slide, bx, 5.42, 2.44, 0.72, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=0.9, rounded=True, radius=0.14)
            add_oval(slide, bx + 0.14, 5.58, 0.10, 0.10, fill_color=C_YELLOW if idx == 1 else C_TECH_MINT)
            add_textbox(slide, bx + 0.32, 5.50, 2.02, 0.24, bh, size_pt=10.2, bold=True, color=C_WHITE)
            add_textbox(slide, bx + 0.32, 5.76, 2.02, 0.28, bs, size_pt=8.8, color=C_BRAND_20)

    # Chân bìa
    add_rect(slide, 0.72, 6.34, 7.65, 0.015, fill_color=C_BRAND_90)
    add_textbox(
        slide, 0.72, 6.46, 7.65, 0.62,
        "Đơn vị thực hiện: Phòng ĐMST&CĐS   -   Tháng 11/2026\nLiên hệ: dmst-cds@vinaseed.com.vn   -   0982.109.295",
        size_pt=10.8, color=C_BRAND_20, line_spacing=1.32,
    )

    with anim.wave(180, 420):
        # Khối nhận diện & thông số công nghệ phía phải
        add_oval(slide, 10.95, 0.78, 1.50, 1.50, fill_color=C_YELLOW)
        add_oval(slide, 10.83, 0.66, 1.74, 1.74, fill_color=C_TECH_BG, line_color=C_BRAND_60, line_pt=0.9)
        add_oval(slide, 10.95, 0.78, 1.50, 1.50, fill_color=C_YELLOW)
        assets.add_symbol(slide, "white", left_in=9.55, top_in=2.48, width_in=2.75)

        add_rect(slide, 9.35, 5.56, 3.48, 1.30, fill_color=C_TECH_BG, line_color=C_BRAND_90, line_pt=1.0, rounded=True, radius=0.10)
        add_rect(slide, 9.52, 5.70, 0.07, 1.02, fill_color=C_TECH_MINT)
        add_textbox(
            slide, 9.72, 5.70, 2.98, 0.24,
            "HỆ SINH THÁI CÔNG NGHỆ NỘI BỘ",
            size_pt=8.8, bold=True, color=C_YELLOW,
        )
        add_textbox(
            slide, 9.72, 5.98, 2.98, 0.76,
            "Web: Next.js 15 + PostgreSQL 16 + OSRM\nApp: Expo Android & iPhone (SQLite)\nPhạm vi: 300-400 CBNV toàn Vinaseed",
            size_pt=9.6, color=C_BRAND_20, line_spacing=1.28,
        )

    anim.apply()
    add_notes(
        slide,
        "Kịch bản Demo 27/11 - Mở đầu (1 phút):\n"
        "- Trình bày bối cảnh xây dựng SeedGW: giải pháp thay thế từng bước hệ thống DMS-CRM cũ (FPT đã dừng hợp tác & hỗ trợ), "
        "hướng tới sự ổn định cho CBNV và có thể trở thành ứng dụng chính thức khi được Ban Lãnh đạo phê duyệt và đầu tư nguồn lực.\n"
        "- Tổng kết toàn bộ năng lực đã hoàn thiện tới 25/11/2026, kết quả đo kiểm thực tế và lộ trình triển khai.",
    )


def build_slide_02_problem(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 2,
        "01", "BỐI CẢNH & BÀI TOÁN THỊ TRƯỜNG",
        "Vinaseed đã có DMS-CRM, nhưng hiện không còn hiệu quả",
        "Nhà cung cấp FPT đã dừng hợp tác và không còn hỗ trợ kịp thời, khiến 4 nhóm vấn đề ảnh hưởng trực tiếp tới CBNV mỗi ngày.",
    )

    cards = [
        (
            "01",
            "Hôm nay DMS có lỗi hay không?",
            "App thường xuyên thiếu ổn định: không đăng nhập được, quay tròn, văng/đơ, lỗi check-in, không tìm thấy đại lý. Báo lỗi trước, trong và sau khi hết bảo trì đều không được FPT hỗ trợ kịp.",
            "CBNV thiếu an tâm, phải ghi hành trình bằng nhiều cách rời rạc",
        ),
        (
            "02",
            "Hôm nay tôi đã đi bao nhiêu km?",
            "Check-in khi đi đường hay thiếu đại lý, quãng đường tính theo km không chính xác khiến việc thanh toán Công tác phí (CTP) gặp nhiều khó khăn, ảnh hưởng quyền lợi người lao động.",
            "Tốn công đối soát, thiếu căn cứ cự ly thanh toán Công tác phí",
        ),
        (
            "03",
            "Tình hình triển khai hoạt động SXKD?",
            "Tính năng theo dõi hoạt động CBNV và Dashboard bị lỗi không thể sử dụng. Ban Điều hành và Lãnh đạo đơn vị không nắm được số liệu theo ngày, tháng, năm để điều hành kịp thời.",
            "Lãnh đạo thiếu bức tranh trực quan trong ngày, chậm quyết định",
        ),
        (
            "04",
            "Đơn hàng lỗi, tạo đại lý khó & quá cồng kềnh",
            "Đặt đơn lỗi liên kết FAST và phê duyệt; tạo đại lý bắt nhập tay toạ độ, không sửa được địa chỉ trên điện thoại. Quá nhiều tính năng thừa phức tạp gây lãng phí khi chỉ dùng được vài mục.",
            "Cồng kềnh, tốn kém đầu tư nhưng vận hành không thông suốt",
        ),
    ]

    positions = [
        (0.60, 1.66),
        (6.82, 1.66),
        (0.60, 3.74),
        (6.82, 3.74),
    ]
    cw, ch = 5.91, 1.92

    for idx, ((num, heading, body, pain), (x, y)) in enumerate(zip(cards, positions)):
        with anim.wave(100 + idx * 110, 340):
            add_rect(slide, x, y, cw, ch, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.06)
            add_rect(slide, x, y + 0.14, 0.08, ch - 0.28, fill_color=C_BRAND if idx < 2 else C_RED)
            add_circle_badge(
                slide, x + 0.22, y + 0.18, 0.42, num,
                bg_color=C_BRAND_10 if idx < 2 else C_RED_SOFT,
                text_color=C_BRAND if idx < 2 else C_RED,
                size_pt=11.5,
            )
            add_textbox(slide, x + 0.76, y + 0.20, cw - 0.94, 0.34, heading, size_pt=14.2, bold=True, color=C_BLACK)
            add_textbox(slide, x + 0.76, y + 0.56, cw - 0.94, 0.88, body, size_pt=10.6, color=C_TEXT_MUTED, line_spacing=1.22)
            add_pill(slide, x + 0.76, y + 1.50, cw - 0.96, 0.28, pain, bg_color=C_RED_SOFT, text_color=C_RED, size_pt=9.2, bold=True)

    # Dải định hướng giải pháp công nghệ ở đáy slide
    with anim.wave(540, 380):
        add_rect(slide, 0.60, 5.84, 12.133, 0.98, fill_color=C_TECH_BG, line_color=C_BRAND, line_pt=1.2, rounded=True, radius=0.10)
        add_pill(slide, 0.84, 6.14, 1.85, 0.38, "ĐỊNH HƯỚNG SEEDGW", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=9.8, bold=True)
        add_textbox(
            slide, 2.86, 5.96, 9.65, 0.74,
            "Giải pháp thay thế theo từng giai đoạn (có thể trở thành ứng dụng chính thức khi được phê duyệt & đầu tư nguồn lực).\n"
            "Mục tiêu cao nhất: Ứng dụng ổn định, tập trung đúng việc cần và được Phòng ĐMST&CĐS hỗ trợ chủ động, kịp thời.",
            size_pt=12.0, bold=True, color=C_WHITE, line_spacing=1.28, valign=MSO_ANCHOR.MIDDLE,
        )

    anim.apply()
    add_notes(
        slide,
        "Nêu thẳng thực trạng hệ thống DMS-CRM cũ của FPT để Ban Lãnh đạo thấy rõ lý do phải làm SeedGW:\n"
        "- FPT đã dừng hợp tác; app hay quay tròn/văng/lỗi; cự ly km sai ảnh hưởng thanh toán Công tác phí (CTP); "
        "Dashboard lỗi; đơn hàng lỗi nối FAST; tạo đại lý phải nhập tay toạ độ; quá nhiều tính năng thừa phức tạp.\n"
        "- Chốt định vị: SeedGW là giải pháp thay thế từng giai đoạn (sẵn sàng thành app chính thức nếu được đầu tư), "
        "ưu tiên số 1 là sự ổn định và sự hỗ trợ trực tiếp, kịp thời từ Phòng ĐMST&CĐS.",
    )


def build_slide_03_overview(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 3,
        "01", "TỔNG QUAN SEEDGW",
        "Một nơi ổn định cho thao tác hàng ngày của CBNV",
        "Web quản lý và App tinh gọn 3 tab (Android & iPhone), đã nạp dữ liệu thật và tự chạy thử 15 lượt / 68,758 km thực địa.",
    )

    # 4 thẻ KPI Hero (cập nhật đúng mã nguồn 25/11: 46 quyền, 17 model, S1, K8)
    kpis = [
        ("15.819", "Đại lý trong danh mục", "Nhập từ hệ thống cũ (C1, C2, C3) + module Khách hàng KH00001"),
        ("291", "Nhân viên đã có tài khoản", "Từ danh sách thật; tự đặt mật khẩu (A2c), dùng ngay trên máy mới (A2b)"),
        ("34 tỉnh / 7 vùng", "Địa giới & Vùng canh tác", "Chuẩn hoá 34 tỉnh mới, 18 mùa vụ, lọc Từ ngày - Đến ngày (K8)"),
        ("5 vai trò", "46 quyền kiểm soát ở máy chủ", "Kiểm phạm vi tự động 17 model, sổ đồng ý SHA-256 (D6, D8)"),
    ]
    kw = 2.86
    gap = 0.23
    for i, (num, title, desc) in enumerate(kpis):
        x = 0.60 + i * (kw + gap)
        with anim.wave(80 + i * 90, 320):
            add_rect(slide, x, 1.66, kw, 1.72, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
            add_card_top_accent(slide, x, 1.66, kw, 1.72, 0.07, fill_color=C_BRAND if i % 2 == 0 else C_OLIVE)
            num_pt = 21.5 if len(num) > 13 else (25.0 if len(num) > 8 else 32.0)
            add_textbox(slide, x + 0.16, 1.84, kw - 0.32, 0.54, num, size_pt=num_pt, bold=True, color=C_BRAND, valign=MSO_ANCHOR.MIDDLE)
            add_textbox(slide, x + 0.16, 2.42, kw - 0.32, 0.30, title, size_pt=11.8, bold=True, color=C_BLACK)
            add_textbox(slide, x + 0.16, 2.74, kw - 0.32, 0.58, desc, size_pt=9.8, color=C_TEXT_MUTED, line_spacing=1.20)

    # 2 khối nền tảng song song (Web & App 3 tab)
    with anim.wave(420, 360):
        add_rect(slide, 0.60, 3.60, 5.92, 1.98, fill_color=C_WHITE, line_color=C_BRAND, line_pt=1.2, rounded=True, radius=0.06)
        add_pill(slide, 0.82, 3.76, 1.60, 0.30, "NỀN TẢNG WEB", bg_color=C_BRAND, text_color=C_WHITE, size_pt=9.5)
        add_textbox(slide, 2.54, 3.77, 3.82, 0.30, "Quản lý, Lãnh đạo, Quản trị & Kế toán", size_pt=11.0, bold=True, color=C_BRAND)
        add_bullet_lines(
            slide, 0.84, 4.18, 5.46, 1.32,
            [
                "Hub 2 bộ phận: Kinh doanh, Quản trị, Tổng quan điều hành & tìm nhanh Ctrl+K.",
                "Báo cáo ghé thăm, Bản đồ hành trình, xuất Excel đúng mẫu thanh toán CTP.",
                "Lập tuyến/chỉ tiêu, duyệt đại lý mới 1 bước, làm sạch dữ liệu & Hỗ trợ SLA.",
            ],
            size_pt=10.3, step_y=0.43,
        )

        add_rect(slide, 6.81, 3.60, 5.92, 1.98, fill_color=C_WHITE, line_color=C_OLIVE, line_pt=1.2, rounded=True, radius=0.06)
        add_pill(slide, 7.03, 3.76, 1.95, 0.30, "APP ĐIỆN THOẠI v0.2.0", bg_color=C_OLIVE, text_color=C_WHITE, size_pt=9.2)
        add_textbox(slide, 9.10, 3.77, 3.45, 0.30, "Android & iPhone - Quý tinh bất quý đa", size_pt=10.8, bold=True, color=C_OLIVE)
        add_bullet_lines(
            slide, 7.05, 4.18, 5.46, 1.32,
            [
                "3 tab tinh gọn: Hôm nay, Lịch sử, Tôi (tuyến hôm nay & ĐL gần tôi ở Hôm nay).",
                "Check-in 1 chạm có giờ máy chủ & địa chỉ; mất mạng lưu SQLite không mất.",
                "Tự ghi hành trình 5s tính km CTP; tick đề xuất ĐL mới; duyệt & Hỗ trợ ở tab Tôi.",
            ],
            size_pt=10.3, dot_color=C_OLIVE, step_y=0.43,
        )

    # Dải 10 phân hệ cốt lõi + nhãn kết quả chạy thử thật
    with anim.wave(560, 340):
        add_textbox(slide, 0.60, 5.76, 6.40, 0.26, "10 PHÂN HỆ ĐÃ TÍCH HỢP & CHẠY TRÊN MÁY CHỦ THỬ SEEDGW", size_pt=9.6, bold=True, color=C_TEXT_MUTED)
        add_pill(
            slide, 7.65, 5.73, 5.08, 0.28,
            "CHẠY THỬ THẬT: 1 NGƯỜI  -  15 LƯỢT GHÉ THĂM  -  68,758 KM",
            bg_color=C_TECH_BG, text_color=C_TECH_MINT, size_pt=8.4, bold=True,
        )
        modules = [
            "Check-in", "Hành trình & CTP", "Đại lý & KH (S1)", "Tuyến & Chỉ tiêu", "Duyệt ĐL mới",
            "Dashboard & Báo cáo", "Tổng quan", "Hỗ trợ SLA", "Đồng ý SHA-256", "Giám sát lỗi F9",
        ]
        pill_gap = 0.07
        usable_w = 12.133 - pill_gap * (len(modules) - 1)
        weights = [len(m) + 3.5 for m in modules]
        total_weight = sum(weights)
        px = 0.60
        for idx, (mod, wt) in enumerate(zip(modules, weights)):
            pw_mod = usable_w * (wt / total_weight)
            is_new = idx in (2, 8, 9)
            add_pill(
                slide, px, 6.10, pw_mod, 0.44, mod,
                bg_color=C_YELLOW_SOFT if is_new else C_BRAND_10,
                text_color=C_BLACK if is_new else C_BRAND,
                size_pt=8.3, bold=True,
                line_color=C_YELLOW if is_new else C_BRAND_20,
            )
            px += pw_mod + pill_gap

    anim.apply()
    add_notes(
        slide,
        "Điểm nhấn cập nhật 25/11: App đã tinh gọn từ 4 tab xuống 3 tab (Hôm nay, Lịch sử, Tôi) theo triết lý "
        "'Quý tinh bất quý đa', bổ sung Khách hàng nông dân/HTX (S1), 46 quyền chi tiết, sổ đồng ý SHA-256 (D8) và tự ghi lỗi nội bộ (F9).",
    )


def build_slide_04_value_comparison(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 4,
        "01", "GIÁ TRỊ MANG LẠI",
        "Từ hệ thống cũ hay lỗi sang nền tảng ổn định, làm chủ hoàn toàn",
        "So sánh trực diện DMS-CRM cũ với SeedGW và lợi ích thiết thực cho từng nhóm người dùng tại Vinaseed.",
    )

    with anim.wave(100, 360):
        # Cột trái: DMS-CRM cũ (FPT)
        add_rect(slide, 0.60, 1.66, 5.75, 3.30, fill_color=C_SURFACE_SUBTLE, line_color=C_BORDER, line_pt=1.0, rounded=True, radius=0.06)
        add_card_header(slide, 0.60, 1.66, 5.75, 0.46, 3.30, 0.06, fill_color=C_TEXT_MUTED)
        add_textbox(slide, 0.80, 1.74, 5.35, 0.30, "HỆ THỐNG DMS-CRM CŨ (FPT NGỪNG HỖ TRỢ)", size_pt=11.5, bold=True, color=C_WHITE)

        before_items = [
            "Độ ổn định: Hay quay tròn, văng/đơ, lỗi đăng nhập; FPT không hỗ trợ kịp.",
            "Cự ly CTP: Tính km thiếu chính xác, thiếu đại lý, khó thanh toán CTP.",
            "Tạo đại lý: Bắt nhập tay toạ độ, không sửa được địa chỉ; dữ liệu trùng/sai.",
            "Điều hành: Dashboard bị lỗi không dùng được; lãnh đạo chậm ra quyết định.",
            "Thiết kế: Ôm đồm quá nhiều tính năng thừa phức tạp, chỉ dùng được vài mục.",
        ]
        add_bullet_lines(slide, 0.82, 2.26, 5.32, 2.60, before_items, size_pt=10.5, color=C_TEXT_MUTED, dot_color=C_RED, step_y=0.52)

    with anim.wave(240, 320, effect="wipe_right"):
        add_arrow_right(slide, 6.46, 3.12, 0.42, 0.40, fill_color=C_YELLOW)

    with anim.wave(300, 380):
        # Cột phải: SeedGW
        add_rect(slide, 6.98, 1.66, 5.75, 3.30, fill_color=C_WHITE, line_color=C_BRAND, line_pt=1.3, rounded=True, radius=0.06)
        add_card_header(slide, 6.98, 1.66, 5.75, 0.46, 3.30, 0.06, fill_color=C_BRAND)
        add_textbox(slide, 7.18, 1.74, 5.35, 0.30, "VỚI SEEDGW (PHÒNG ĐMST&CĐS LÀM CHỦ)", size_pt=11.5, bold=True, color=C_WHITE)

        after_items = [
            "Ổn định & Hỗ trợ: Xử lý nền (F8), offline-first; ĐMST&CĐS tự giám sát & hỗ trợ.",
            "Cự ly CTP: Khớp đường thật OSRM (sai số 0,3-1,8%), xuất Excel chuẩn CTP.",
            "Đại lý & KH sạch: Đề xuất ĐL tự lấy GPS/địa chỉ, gộp trùng, sửa SĐT, có KH S1.",
            "Điều hành thực thời: Dashboard tải 0,64s, lọc tự do Từ ngày - Đến ngày (K8).",
            "Tinh gọn: App 3 tab dễ dùng; làm chắc từng chặng, sẵn sàng nâng thành bản chính.",
        ]
        add_bullet_lines(slide, 7.20, 2.26, 5.32, 2.60, after_items, size_pt=10.5, color=C_BLACK, dot_color=C_BRAND, step_y=0.52)

    # 4 thẻ lợi ích theo nhóm người dùng ở phần dưới
    benefits = [
        ("CBNV Thị trường", "Mở app check-in 1 chạm không lo quay tròn/văng; tự thấy km CTP minh bạch và % chỉ tiêu mỗi ngày.", C_YELLOW),
        ("Ban Lãnh đạo & Quản lý", "Góc nhìn từ tổng quan tới chi tiết theo bất kỳ khoảng ngày nào; duyệt tuyến, chỉ tiêu & ĐL mới tức thì.", C_BRAND),
        ("Quản trị & Kế toán", "Xuất Excel mẫu cự ly thanh toán CTP; bộ công cụ dọn sạch dữ liệu trùng/SĐT sai; hỗ trợ SLA rõ hạn.", C_OLIVE),
        ("Toàn công ty & ĐMST&CĐS", "Tự chủ hoàn toàn mã nguồn & hạ tầng; không lệ thuộc nhà cung cấp ngoài; dễ mở rộng theo giai đoạn.", C_BRAND_80),
    ]
    bw = 2.86
    bgap = 0.23
    for i, (role_name, text, accent) in enumerate(benefits):
        bx = 0.60 + i * (bw + bgap)
        with anim.wave(460 + i * 80, 320):
            add_rect(slide, bx, 5.18, bw, 1.62, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.06)
            add_card_top_accent(slide, bx, 5.18, bw, 1.62, 0.06, fill_color=accent)
            add_textbox(slide, bx + 0.16, 5.36, bw - 0.32, 0.32, role_name, size_pt=11.6, bold=True, color=C_BRAND)
            add_textbox(slide, bx + 0.16, 5.70, bw - 0.32, 1.00, text, size_pt=9.9, color=C_TEXT_MUTED, line_spacing=1.22)

    anim.apply()
    add_notes(
        slide,
        "So sánh trực diện từng điểm yếu của DMS-CRM cũ (FPT) với cách SeedGW giải quyết triệt để. "
        "Nhấn mạnh triết lý: không ôm đồm tính năng rườm rà mà làm chắc, ổn định và chủ động hỗ trợ nội bộ.",
    )


def build_slide_05_what_is_built(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 5,
        "02", "HIỆN TRẠNG HOÀN THIỆN",
        "Những gì SeedGW đã hoàn thiện tới ngày 25/11/2026",
        "Toàn bộ luồng cốt lõi cùng 12 hạng mục nâng cấp ngày 25/11 (S1, M12, K8, M10b, D3-D8, F8-F9) đã đưa lên máy chủ thử.",
    )

    with anim.wave(100, 360):
        # Cột trái: Web (9 nhóm tính năng)
        add_rect(slide, 0.60, 1.64, 6.22, 4.54, fill_color=C_WHITE, line_color=C_BRAND_20, line_pt=1.2, rounded=True, radius=0.06)
        add_card_header(slide, 0.60, 1.64, 6.22, 0.44, 4.54, 0.06, fill_color=C_BRAND)
        add_textbox(slide, 0.80, 1.72, 4.10, 0.28, "WEB - QUẢN LÝ, LÃNH ĐẠO, QUẢN TRỊ", size_pt=11.2, bold=True, color=C_WHITE)
        add_pill(slide, 5.26, 1.73, 1.40, 0.26, "9 NHÓM ĐÃ XONG", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=8.6)

        web_items = [
            ("Hub, Ctrl+K & Thông báo (D3, D4): ", "Việc cần làm thật, tìm nhanh toàn cục Ctrl+K, trang /thong-bao."),
            ("Phân quyền & Tài khoản (A2b-c, D6): ", "5 vai trò, 46 quyền, tự đặt mật khẩu, rà OWASP & check:scope."),
            ("Đại lý & Khách hàng (A7b, S1): ", "15.819 đại lý + Khách hàng nông dân/HTX (KH00001), gộp trùng, sửa SĐT."),
            ("Duyệt ĐL mới & Toạ độ (M10b, M4): ", "Quản lý/Lãnh đạo duyệt 1 bước; NV theo dõi tại /dai-ly/de-xuat."),
            ("Check-in, Bản đồ & Excel CTP: ", "Ảnh, địa chỉ, km đường đi OSRM và GPS, 7 cờ, xuất Excel chuẩn CTP."),
            ("Tuyến & Chỉ tiêu (S8, K3): ", "Lập tuyến tuần/ngày trên web, giao/đăng ký chỉ tiêu, duyệt 2 cấp."),
            ("Dashboard, Báo cáo & Tổng quan (K1-K8): ", "Lọc Từ ngày - Đến ngày linh hoạt, 7 vùng/34 tỉnh, tải cả năm 0,64s."),
            ("Đồng ý SHA-256 & Lỗi nội bộ (D8, F9): ", "Sổ đồng ý Luật BVDLCN, in giấy PDF, trang /quan-tri/loi-he-thong."),
            ("Hỗ trợ SLA & Kết nối FAST: ", "Nút nổi mọi trang, SLA 1h/4h, sẵn trang /quan-tri/ket-noi v1.7."),
        ]
        tb_w = add_textbox(slide, 0.80, 2.18, 5.84, 3.92)
        add_rich_paragraphs(tb_w.text_frame, web_items, title_pt=9.9, body_pt=9.7, title_color=C_BRAND, body_color=C_BLACK, space_after_pt=4.5, line_spacing=1.16)

    with anim.wave(240, 360):
        # Cột phải: App điện thoại v0.2.0
        add_rect(slide, 7.06, 1.64, 5.67, 4.54, fill_color=C_WHITE, line_color=C_OLIVE, line_pt=1.2, rounded=True, radius=0.06)
        add_card_header(slide, 7.06, 1.64, 5.67, 0.44, 4.54, 0.06, fill_color=C_OLIVE)
        add_textbox(slide, 7.26, 1.72, 3.70, 0.28, "APP TINH GỌN v0.2.0 - ANDROID, IPHONE", size_pt=11.0, bold=True, color=C_WHITE)
        add_pill(slide, 11.16, 1.73, 1.40, 0.26, "6 TRỤ CỘT XONG", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=8.6)

        app_items = [
            ("Gọn 3 tab Quý tinh bất quý đa (M12): ", "Hôm nay, Lịch sử, Tôi; gộp tuyến hôm nay, Đại lý gần tôi và 1 dòng % chỉ tiêu vào ngay tab Hôm nay."),
            ("Check-in & Đề xuất ĐL 1 mạch: ", "Chụp ảnh in giờ máy chủ & địa chỉ; chọn Đại lý, Khách hàng (S1) hoặc tick Đây là đại lý mới (tự lấy GPS)."),
            ("Ổn định, Offline-first & Worker (F8): ", "Hàng đợi SQLite lưu máy, tự gửi bù không trùng (clientId); tính km & địa chỉ chạy nền chống đơ app."),
            ("Hành trình 5s & Lịch sử 18 tháng: ", "Tự ghi từ lượt đầu ngày, tự dừng 20:00, tự kiểm lượt & km công tác phí ngay trên điện thoại."),
            ("Duyệt nhanh, Hỗ trợ & Đồng ý (tab Tôi): ", "Quản lý/Lãnh đạo duyệt tuyến, chỉ tiêu & ĐL mới; nút nổi Hỗ trợ chỉ ở tab Tôi; chia sẻ giấy đồng ý PDF."),
            ("Thân thiện & Tự báo lỗi (D7, M7, F9): ", "Phóng to cỡ chữ máy (1,6x) vẫn đủ nút; 4 nhóm thông báo đẩy thiết yếu; tự gửi lỗi JS về ĐMST&CĐS."),
        ]
        tb_a = add_textbox(slide, 7.26, 2.20, 5.28, 3.90)
        add_rich_paragraphs(tb_a.text_frame, app_items, title_pt=10.3, body_pt=10.0, title_color=C_BRAND_DARK, body_color=C_BLACK, space_after_pt=7.2, line_spacing=1.20)

    with anim.wave(400, 360):
        # Thanh trạng thái mới nhất ở đáy
        add_rect(slide, 0.60, 6.32, 12.133, 0.56, fill_color=C_YELLOW_SOFT, line_color=C_YELLOW, line_pt=1.0, rounded=True, radius=0.14)
        add_pill(slide, 0.78, 6.45, 1.82, 0.30, "MỚI NHẤT 25/11", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=9.2)
        add_textbox(
            slide, 2.74, 6.32, 9.80, 0.56,
            "Đã đưa lên máy chủ thử & đẩy OTA bản app 0.2.0 (nhóm 8f52d00e). Phần chờ bên ngoài: API FAST & máy chủ IT Vinaseed.",
            size_pt=10.6, bold=True, color=C_BLACK, valign=MSO_ANCHOR.MIDDLE,
        )

    anim.apply()
    add_notes(
        slide,
        "Slide cập nhật đầy đủ những gì vừa hoàn thiện trong ngày 25/11: S1 Khách hàng, M12 App 3 tab, K8 lọc Từ ngày - Đến ngày, "
        "M10b duyệt ĐL mới 1 bước, D3 Ctrl+K, D4 Trung tâm thông báo, D5 chia bảng GPS, D6 OWASP, D7 responsive/chữ to, D8 Sổ đồng ý SHA-256, F8 Worker, F9 Tự ghi lỗi.",
    )


def build_slide_06_roles_matrix(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 6,
        "02", "PHÂN QUYỀN VÀ PHẠM VI",
        "Năm vai trò, 46 quyền chi tiết kiểm soát tự động tại máy chủ",
        "Mỗi tài khoản có phạm vi dữ liệu riêng; kiểm tra tự động trên 17 model nghiệp vụ (pnpm check:scope).",
    )

    # 5 thẻ vai trò dạng bậc thang phạm vi
    roles = [
        ("1. Nhân viên KD", "Phạm vi: Của tôi", "App 3 tab, Đề xuất ĐL", C_BRAND_10, C_BRAND),
        ("2. Quản lý", "Phạm vi: Nhóm", "Duyệt bước 1 & ĐL mới", C_BRAND_20, C_BRAND),
        ("3. Lãnh đạo đơn vị", "Phạm vi: Đơn vị", "Tổng quan, Giao chỉ tiêu", C_BRAND_30, C_BRAND_DARK),
        ("4. Quản trị đơn vị", "Phạm vi: Đơn vị", "Dữ liệu, Toạ độ, Hỗ trợ", C_OLIVE, C_WHITE),
        ("5. Quản trị hệ thống", "Phạm vi: Toàn công ty", "Cấu hình, Lỗi F9, FAST", C_BRAND, C_WHITE),
    ]
    rw = 2.22
    rgap = 0.258
    for i, (rname, rscope, ruse, rbg, rfg) in enumerate(roles):
        rx = 0.60 + i * (rw + rgap)
        with anim.wave(80 + i * 70, 300):
            add_rect(slide, rx, 1.64, rw, 1.04, fill_color=rbg, line_color=C_BRAND_20 if i < 3 else None, line_pt=1.0, rounded=True, radius=0.08)
            add_textbox(slide, rx + 0.12, 1.72, rw - 0.24, 0.28, rname, size_pt=10.8, bold=True, color=rfg)
            add_textbox(slide, rx + 0.12, 2.02, rw - 0.24, 0.26, rscope, size_pt=9.8, bold=True, color=rfg)
            add_textbox(slide, rx + 0.12, 2.30, rw - 0.24, 0.30, ruse, size_pt=9.0, color=rfg if i >= 3 else C_TEXT_MUTED)
            if i < 4:
                add_arrow_right(slide, rx + rw + 0.05, 2.06, 0.16, 0.20, fill_color=C_BRAND_40)

    # Bảng ma trận quyền native PowerPoint (cập nhật đúng M10b, D8, F9)
    headers = ["Nghiệp vụ chính", "NVKD", "Quản lý", "Lãnh đạo ĐV", "Quản trị ĐV", "Quản trị HT"]
    rows_data = [
        ["Check-in, Khách hàng S1, Hỗ trợ, Đồng ý D8", "Có", "Có", "Có", "Có", "Có"],
        ["Đăng ký tuyến (Web), chỉ tiêu tháng", "Có", "Có", "Có", "Không", "Làm thay"],
        ["Duyệt tuyến & chỉ tiêu (2 cấp)", "Không", "Bước 1", "Duyệt cuối", "Chỉ xem", "Làm thay"],
        ["Đề xuất & Duyệt đại lý mới (M10b)", "Đề xuất", "Duyệt 1 bước", "Duyệt / Tự tạo", "Chỉ xem", "Duyệt thay"],
        ["Giao chỉ tiêu tháng (tay / Excel)", "Không", "Không", "Có", "Không", "Có"],
        ["Dashboard & Báo cáo (Từ ngày - Đến ngày)", "Của tôi", "Nhóm", "Đơn vị", "Đơn vị", "Toàn công ty"],
        ["Tổng quan điều hành (/tong-quan)", "Không", "Không", "Có", "Không", "Có"],
        ["Duyệt toạ độ, gộp trùng, sửa SĐT sai", "Không", "Không", "Không", "Đơn vị", "Toàn công ty"],
        ["Tài khoản, Đồng ý dữ liệu, Xử lý Hỗ trợ", "Không", "Không", "Không", "Đơn vị", "Toàn bộ / Cấp 2"],
        ["Tham số, Lỗi hệ thống (F9), Kết nối FAST", "Không", "Không", "Không", "Không", "Có"],
    ]

    with anim.wave(440, 380):
        num_rows = len(rows_data) + 1
        num_cols = len(headers)
        tbl_shape = slide.shapes.add_table(num_rows, num_cols, Inches(0.60), Inches(2.84), Inches(12.133), Inches(3.72))
        table = tbl_shape.table
        tblPr = table._tbl.tblPr
        tblPr.set("firstRow", "0")
        tblPr.set("bandRow", "0")
        for style_id in list(tblPr.findall(qn("a:tableStyleId"))):
            tblPr.remove(style_id)

        col_widths = [4.053, 1.46, 1.56, 1.66, 1.66, 1.74]
        for ci, cw in enumerate(col_widths):
            table.columns[ci].width = Inches(cw)

        table.rows[0].height = Inches(0.38)
        for ci, htext in enumerate(headers):
            style_table_cell(
                table.cell(0, ci), htext, C_BRAND, C_WHITE, size_pt=10.2, bold=True,
                align=PP_ALIGN.LEFT if ci == 0 else PP_ALIGN.CENTER, border_hex="005B36",
            )

        for ri, row in enumerate(rows_data, start=1):
            table.rows[ri].height = Inches(0.334)
            base_bg = C_WHITE if ri % 2 == 1 else C_BRAND_05
            for ci, val in enumerate(row):
                if ci == 0:
                    style_table_cell(table.cell(ri, ci), val, base_bg, C_BLACK, size_pt=9.4, bold=True, align=PP_ALIGN.LEFT)
                else:
                    if val == "Không":
                        fg = C_TEXT_MUTED
                        bg = base_bg
                        bld = False
                    elif val in ("Bước 1", "Duyệt cuối", "Làm thay", "Duyệt 1 bước", "Duyệt / Tự tạo", "Duyệt thay"):
                        fg = C_BRAND_DARK
                        bg = C_YELLOW_SOFT
                        bld = True
                    elif val in ("Chỉ xem", "Đề xuất"):
                        fg = C_TEXT_MUTED
                        bg = C_SURFACE_SUBTLE
                        bld = False
                    else:
                        fg = C_BRAND
                        bg = C_BRAND_10 if val == "Có" else base_bg
                        bld = True
                    style_table_cell(table.cell(ri, ci), val, bg, fg, size_pt=9.2, bold=bld, align=PP_ALIGN.CENTER)

    add_textbox(
        slide, 0.60, 6.64, 12.133, 0.28,
        "Ghi chú: Luồng M10b (25/11) chuyển duyệt đại lý mới về Quản lý/Lãnh đạo đơn vị duyệt 1 bước; đổi cơ cấu tự chuyển người duyệt. Mọi trang và API kiểm quyền tại máy chủ.",
        size_pt=9.2, italic=True, color=C_TEXT_MUTED,
    )

    anim.apply()
    add_notes(
        slide,
        "Cập nhật 25/11 trên ma trận quyền: 46 quyền chi tiết (thêm admin.error-log.read của F9), "
        "duyệt đại lý mới chuyển sang luồng 1 bước cho Quản lý/Lãnh đạo đơn vị (M10b), Quản trị đơn vị theo dõi Đồng ý dữ liệu của đơn vị (D8).",
    )


def build_slide_07_e2e_flow(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 7,
        "03", "LUỒNG NGHIỆP VỤ CỐT LÕI",
        "Vòng làm việc khép kín từ thị trường tới thanh toán CTP & điều hành",
        "Mọi thao tác thực địa chảy qua hàng đợi xử lý nền tự động, phục vụ đồng thời quản lý, kế toán CTP và Ban Lãnh đạo.",
    )

    steps = [
        (
            "BƯỚC 1",
            "Lập tuyến & Chỉ tiêu",
            "Web (duyệt Web & App)",
            [
                "Đăng ký tuyến tuần/ngày (tối đa 30 điểm/ngày) trên Web.",
                "Sắp đường gần nhất, duyệt 2 cấp.",
                "Lãnh đạo giao chỉ tiêu tháng.",
            ],
            C_BRAND,
        ),
        (
            "BƯỚC 2",
            "Check-in thực địa",
            "App tinh gọn 3 tab",
            [
                "Chụp ảnh in giờ máy chủ & địa chỉ.",
                "Chọn ĐL, KH (S1) hoặc tick ĐL mới.",
                "Ghi GPS 5s; mất mạng lưu SQLite.",
            ],
            C_BRAND_90,
        ),
        (
            "BƯỚC 3",
            "Worker xử lý nền",
            "BullMQ, OSRM, Vietmap",
            [
                "Hàng đợi F8 tính km & địa chỉ, thử lại 5 lần (chống đơ app).",
                "Khớp đường xe máy bằng OSRM.",
                "Chạy 7 cờ nghi vấn, tự ghi lỗi F9.",
            ],
            C_OLIVE,
        ),
        (
            "BƯỚC 4",
            "Đối soát & Thanh toán CTP",
            "Quản lý, Kế toán",
            [
                "Xem bảng check-in, ảnh, bản đồ ngày.",
                "Duyệt 1 bước ĐL mới & toạ độ.",
                "Xuất Excel đúng mẫu cự ly CTP.",
            ],
            C_BRAND_80,
        ),
        (
            "BƯỚC 5",
            "Điều hành trực quan",
            "Dashboard, Tổng quan",
            [
                "Lọc tự do Từ ngày - Đến ngày (K8).",
                "Theo dõi độ phủ, lượt ghé, % chỉ tiêu.",
                "Cảnh báo đại lý lâu chưa ghé thăm.",
            ],
            C_BRAND_DARK,
        ),
    ]

    sw = 2.22
    sgap = 0.258
    for i, (stag, stitle, splat, sbullets, scolor) in enumerate(steps):
        sx = 0.60 + i * (sw + sgap)
        with anim.wave(80 + i * 95, 340):
            add_rect(slide, sx, 1.74, sw, 3.72, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.06)
            add_card_header(slide, sx, 1.74, sw, 0.86, 3.72, 0.06, fill_color=scolor)
            add_textbox(slide, sx + 0.14, 1.82, sw - 0.28, 0.24, stag, size_pt=9.2, bold=True, color=C_YELLOW)
            add_textbox(slide, sx + 0.14, 2.06, sw - 0.28, 0.48, stitle, size_pt=12.0, bold=True, color=C_WHITE, line_spacing=1.12)
            add_pill(slide, sx + 0.12, 2.72, sw - 0.24, 0.28, splat, bg_color=C_BRAND_10, text_color=C_BRAND, size_pt=8.5)
            add_bullet_lines(slide, sx + 0.14, 3.12, sw - 0.24, 2.20, sbullets, size_pt=9.8, color=C_BLACK, dot_color=scolor, step_y=0.72, bold_prefix_sep=None)
            if i < 4:
                add_arrow_right(slide, sx + sw + 0.04, 2.06, 0.18, 0.24, fill_color=C_YELLOW)

    # 3 hộp chính sách vận hành dữ liệu ở đáy
    policies = [
        ("ĐỘ MỚI & HÀNG ĐỢI NỀN (F8)", "Check-in phản hồi ngay không đơ máy; worker BullMQ tính km/địa chỉ có thử lại 5 lần; bảng gộp K1 làm mới mỗi 15 phút."),
        ("LƯU TRỮ & TỰ DỌN TỰ ĐỘNG (D5)", "Bảng GPS chia theo tháng; 02:00 mỗi đêm tự xoá vết GPS & ảnh quá 45 ngày, dòng check-in & km giữ 18 tháng."),
        ("TOÀN VẸN LỊCH SỬ & PHÁP LÝ (D8)", "Lưu đơn vị/NV tại thời điểm ghé thăm (đổi địa bàn không lệch số cũ); sổ đồng ý dữ liệu SHA-256 chỉ ghi thêm."),
    ]
    pw = 3.88
    pgap = 0.246
    for i, (ptitle, pbody) in enumerate(policies):
        px = 0.60 + i * (pw + pgap)
        with anim.wave(560 + i * 70, 320):
            add_rect(slide, px, 5.68, pw, 1.14, fill_color=C_WHITE, line_color=C_BRAND_20, line_pt=1.0, rounded=True, radius=0.07)
            add_rect(slide, px, 5.80, 0.07, 0.90, fill_color=C_BRAND if i != 1 else C_OLIVE)
            add_textbox(slide, px + 0.18, 5.76, pw - 0.32, 0.26, ptitle, size_pt=9.8, bold=True, color=C_BRAND)
            add_textbox(slide, px + 0.18, 6.04, pw - 0.32, 0.72, pbody, size_pt=9.8, color=C_BLACK, line_spacing=1.20)

    anim.apply()
    add_notes(
        slide,
        "Nhấn mạnh điểm mới F8 và D5: mọi tác vụ nặng (tính km, hỏi địa chỉ Vietmap, khớp OSRM) đều đẩy vào worker BullMQ "
        "để app phản hồi tức thì, không bao giờ quay tròn hay treo máy như DMS cũ.",
    )


def _draw_phone_frame_3tab(slide, x: float, y: float, w: float, h: float, title: str, active_tab: int) -> None:
    """Vẽ khung điện thoại công nghệ khớp đúng App tinh gọn 3 tab (Hôm nay, Lịch sử, Tôi - M12)."""
    add_rect(slide, x, y, w, h, fill_color=RGBColor(0x14, 0x20, 0x1B), line_color=C_BRAND_80, line_pt=1.1, rounded=True, radius=0.10)
    sx, sy, sw, sh = x + 0.10, y + 0.12, w - 0.20, h - 0.24
    add_rect(slide, sx, sy, sw, sh, fill_color=C_WHITE, rounded=True, radius=0.06)
    # Thanh trạng thái + tiêu đề xanh
    add_rect(slide, sx, sy, sw, 0.46, fill_color=C_BRAND)
    add_textbox(slide, sx + 0.12, sy + 0.03, 0.60, 0.14, "09:41", size_pt=6.8, bold=True, color=C_BRAND_20)
    add_textbox(slide, sx + sw - 0.72, sy + 0.03, 0.60, 0.14, "4G  92%", size_pt=6.8, color=C_BRAND_20, align=PP_ALIGN.RIGHT)
    add_textbox(slide, sx + 0.12, sy + 0.18, sw - 0.24, 0.24, title, size_pt=10.2, bold=True, color=C_WHITE)
    # Thanh tab đáy: ĐÚNG 3 TAB (Hôm nay, Lịch sử, Tôi) theo M12 (25/11/2026)
    tab_y = sy + sh - 0.42
    add_rect(slide, sx, tab_y, sw, 0.42, fill_color=C_SURFACE_SUBTLE, line_color=C_BORDER, line_pt=0.6)
    tabs = ["Hôm nay", "Lịch sử", "Tôi"]
    tw = sw / 3.0
    for idx, tlabel in enumerate(tabs):
        tx = sx + idx * tw
        is_active = idx == active_tab
        add_textbox(
            slide, tx, tab_y + 0.11, tw, 0.24, tlabel,
            size_pt=8.8, bold=is_active,
            color=C_BRAND if is_active else C_TEXT_MUTED,
            align=PP_ALIGN.CENTER,
        )
        if is_active:
            add_rect(slide, tx + 0.16, tab_y, tw - 0.32, 0.045, fill_color=C_BRAND)


def build_slide_08_mobile_app(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 8,
        "03", "APP TINH GỌN 3 TAB (M12)",
        "Quý tinh bất quý đa: ảnh chụp thật 3 tab trên iPhone v0.2.0",
        "Rút gọn còn 3 tab (Hôm nay, Lịch sử, Tôi), xoá bỏ tính năng rườm rà của DMS cũ, tối ưu 1 chạm ngoài thị trường.",
    )

    # Bên trái: 3 khung iPhone hiển thị ĐỦ 3 ẢNH CHỤP MÀN HÌNH THẬT (Hôm nay, Lịch sử, Tôi)
    phones_spec = [
        ("app_today", "Tab Hôm nay (Check-in 1 chạm)", C_BRAND, C_WHITE),
        ("app_history", "Tab Lịch sử (18/11 - 23,703 km)", C_BRAND_10, C_BRAND),
        ("app_me", "Tab Tôi (Hỗ trợ & Cài đặt)", C_BRAND_10, C_BRAND),
    ]
    screen_h = 4.52
    phone_gap = 0.16
    cur_x = 0.60
    for idx, (img_key, cap, cap_bg, cap_fg) in enumerate(phones_spec):
        with anim.wave(90 + idx * 100, 350):
            if assets.has_screenshot(img_key):
                fw = assets.add_phone_screenshot(
                    slide, img_key, cur_x, 1.66, screen_h, cap,
                    caption_bg=cap_bg, caption_fg=cap_fg,
                )
            else:
                fw = 2.24
                _draw_phone_frame_3tab(slide, cur_x, 1.66, fw, screen_h + 0.17, cap, active_tab=idx)
            cur_x += fw + phone_gap

    # Bên phải: 4 trụ cột trải nghiệm App v0.2.0
    pillars = [
        (
            "01",
            "Gọn 3 tab - Hết quay tròn, văng/đơ app",
            "Bỏ tab Tuyến rời và màn lập tuyến/chỉ tiêu (đưa về Web). Tác vụ nặng chạy ở worker (F8) giúp mở app là check-in 1 chạm tức thì.",
        ),
        (
            "02",
            "Offline-first SQLite: Mất sóng không mất",
            "Lưu hàng đợi SQLite ngay trên máy, tự gửi bù khi có mạng, chống trùng bằng clientId. Đã chạy thử thật 15 lượt / 68,758 km không mất lượt.",
        ),
        (
            "03",
            "Đề xuất ĐL mới & KH (S1) ngay khi chụp",
            "Chọn Đại lý, Khách hàng (S1) hoặc tick Đây là đại lý mới tại Điểm khác: tự lấy GPS & địa chỉ, hết cảnh nhập tay toạ độ như DMS cũ.",
        ),
        (
            "04",
            "Lịch sử cự ly rõ ràng & Hỗ trợ chủ động",
            "Tab Lịch sử hiện rõ từng chặng, địa chỉ và km theo đường đi; phóng to chữ 1,6x vẫn đủ nút (D7); nút nổi Hỗ trợ gọn ngay ở tab Tôi.",
        ),
    ]
    px = 7.82
    pw_card = 4.91
    for idx, (num, head, desc) in enumerate(pillars):
        py = 1.66 + idx * 1.30
        with anim.wave(360 + idx * 80, 320):
            add_rect(slide, px, py, pw_card, 1.18, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
            add_circle_badge(slide, px + 0.16, py + 0.22, 0.40, num, bg_color=C_BRAND if idx % 2 == 0 else C_OLIVE, text_color=C_WHITE, size_pt=10.5)
            add_textbox(slide, px + 0.68, py + 0.14, pw_card - 0.82, 0.30, head, size_pt=11.6, bold=True, color=C_BRAND)
            add_textbox(slide, px + 0.68, py + 0.45, pw_card - 0.82, 0.68, desc, size_pt=9.6, color=C_TEXT_MUTED, line_spacing=1.20)

    anim.apply()
    add_notes(
        slide,
        "Slide sử dụng 3 ảnh chụp màn hình thật từ iPhone chạy bản SeedGW v0.2.0 (26/11/2026): "
        "Tab Hôm nay (1 chạm chụp ảnh & Đại lý gần tôi), Tab Lịch sử (chuyến chạy thử thật 18/11 dài 23,703 km, hiện rõ km từng chặng 8,544 km và 3,454 km theo đường), "
        "và Tab Tôi (nút nổi Hỗ trợ, Thông báo, Quyền vị trí, Rút lại đồng ý, Thông tin kỹ thuật).",
    )


def build_slide_09_osrm_proof(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 9,
        "04", "THỰC CHỨNG CỰ LY CÔNG TÁC PHÍ",
        "Tính km bằng OSRM nội bộ: sai số 0,3% - 1,8%, minh bạch CTP",
        "1 người tự chạy thử 3 chuyến thực địa (15 lượt ghé thăm, tổng 68,758 km); sai số vượt xa mục tiêu 5-10% cho CTP.",
    )

    with anim.wave(100, 380):
        # Khung trái: Biểu đồ cột ngang Native PowerPoint
        add_rect(slide, 0.60, 1.66, 7.10, 4.24, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.06)
        add_textbox(
            slide, 0.82, 1.80, 6.66, 0.32,
            "Độ lệch (%) so với đồng hồ xe máy thực tế (mục tiêu dưới 5%)",
            size_pt=12.2, bold=True, color=C_BRAND,
        )
        add_textbox(
            slide, 0.82, 2.12, 6.66, 0.24,
            "Đo kiểm thực địa 12/11 và 18/11/2026 trên OSRM 5.27.1 chế độ xe máy (không đi cao tốc, có đường đất)",
            size_pt=9.6, color=C_TEXT_MUTED,
        )

        chart_data = CategoryChartData()
        chart_data.categories = [
            "18/11 Bình quân chặng",
            "18/11 Toàn tuyến (15,1 km)",
            "12/11 Thực địa (36,0 km)",
        ]
        chart_data.add_series("OSRM theo đường đi (%)", (2.3, 0.3, 1.8))
        chart_data.add_series("GPS thô đã lọc (%)", (3.4, 2.2, 2.7))

        chart_frame = slide.shapes.add_chart(
            XL_CHART_TYPE.BAR_CLUSTERED,
            Inches(0.75), Inches(2.46), Inches(6.75), Inches(3.26),
            chart_data,
        )
        chart = chart_frame.chart
        chart.has_title = False
        chart.has_legend = True
        chart.legend.position = XL_LEGEND_POSITION.TOP
        chart.legend.include_in_layout = False
        chart.legend.font.name = FONT_NAME
        chart.legend.font.size = Pt(10.0)

        plot = chart.plots[0]
        plot.gap_width = 75
        plot.overlap = -15
        plot.has_data_labels = True
        dlabels = plot.data_labels
        dlabels.font.name = FONT_NAME
        dlabels.font.size = Pt(10.0)
        dlabels.font.bold = True

        series_colors = [C_BRAND, C_BRAND_40]
        series_labels = [
            ("2,3%", "0,3%", "1,8%"),
            ("3,4%", "2,2%", "2,7%"),
        ]
        for idx, series in enumerate(plot.series):
            series.format.fill.solid()
            series.format.fill.fore_color.rgb = series_colors[idx]
            for pt_idx, lbl_text in enumerate(series_labels[idx]):
                dl = series.points[pt_idx].data_label
                tf = dl.text_frame
                tf.clear()
                p = tf.paragraphs[0]
                r = p.add_run()
                r.text = lbl_text
                r.font.name = FONT_NAME
                r.font.size = Pt(10.0)
                r.font.bold = True
                r.font.color.rgb = C_BLACK

        val_axis = chart.value_axis
        val_axis.minimum_scale = 0.0
        val_axis.maximum_scale = 5.5
        val_axis.major_unit = 1.0
        val_axis.has_major_gridlines = True
        val_axis.major_gridlines.format.line.color.rgb = C_BRAND_10
        val_axis.tick_labels.font.name = FONT_NAME
        val_axis.tick_labels.font.size = Pt(9.5)
        val_axis.tick_labels.number_format = '0"%"'

        cat_axis = chart.category_axis
        cat_axis.tick_labels.font.name = FONT_NAME
        cat_axis.tick_labels.font.size = Pt(10.0)
        cat_axis.tick_labels.font.bold = True

    with anim.wave(240, 340):
        # Khung ghi chú tổng hợp số liệu chạy thử thật 68,758 km / 15 lượt
        add_rect(slide, 0.60, 6.00, 7.10, 0.84, fill_color=C_BRAND_05, line_color=C_BRAND_20, line_pt=1.0, rounded=True, radius=0.08)
        add_textbox(
            slide, 0.78, 6.06, 6.76, 0.72,
            "Tổng hợp chạy thử thực tế (1 người tự đi thử, 15 lượt ghé thăm): 68,758 km (34,288 + 10,767 + 23,703 km).\n"
            "Chuyến đo đối chiếu 18/11: đường lớn 12,1 km lệch 0,8%; phố cổ 3,0 km lệch 1,9%. Bộ lọc đứng yên (40 m / 60s) loại sạch km giả.",
            size_pt=9.4, color=C_BLACK, line_spacing=1.22, valign=MSO_ANCHOR.MIDDLE,
        )

    # Cột phải: 3 thẻ giá trị nổi bật
    right_cards = [
        (
            "0,3% - 1,8%",
            "Đủ căn cứ minh bạch thanh toán Công tác phí",
            "Vượt xa ngưỡng sai số 5-10% dự kiến trình Lãnh đạo duyệt. Đoạn mất sóng được nối đường ngắn nhất và ghi nhãn ước tính trên Excel để kế toán & CBNV cùng rõ ràng.",
            C_BRAND,
        ),
        (
            "0 đ / lượt",
            "Tiết kiệm ~1.500 USD/tháng phí Google Roads",
            "Với 300 NVKD (~170.000 lượt khớp đường/tháng): OSRM tự host tốn 0 đ phí API. Chỉ trả phí đổi địa chỉ Vietmap khoảng 2,1 triệu đ/tháng.",
            C_OLIVE,
        ),
        (
            "100% nội bộ",
            "Giữ dữ liệu vị trí trong hạ tầng Vinaseed",
            "Vết GPS nhân viên không gửi ra máy chủ nước ngoài. Tách sẵn lớp RoadDistanceProvider, sẵn sàng đổi sang Vietmap mà không phải sửa báo cáo.",
            C_BRAND_DARK,
        ),
    ]
    rx = 7.95
    rw = 4.78
    for i, (big, title, desc, color) in enumerate(right_cards):
        ry = 1.66 + i * 1.76
        with anim.wave(280 + i * 110, 340):
            add_rect(slide, rx, ry, rw, 1.64, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
            add_rect(slide, rx, ry + 0.14, 0.08, 1.36, fill_color=color)
            add_textbox(slide, rx + 0.22, ry + 0.12, rw - 0.36, 0.44, big, size_pt=22.0, bold=True, color=color)
            add_textbox(slide, rx + 0.22, ry + 0.56, rw - 0.36, 0.28, title, size_pt=10.8, bold=True, color=C_BLACK)
            add_textbox(slide, rx + 0.22, ry + 0.84, rw - 0.36, 0.72, desc, size_pt=9.5, color=C_TEXT_MUTED, line_spacing=1.18)

    anim.apply()
    add_notes(
        slide,
        "Gắn trực tiếp kết quả đo OSRM với bài toán Công tác phí (CTP) của CBNV: hệ thống DMS cũ tính km sai lệch lớn gây thiệt thòi "
        "và khó đối soát; SeedGW đo thực tế đạt sai số 0,3%-1,8% (tốt hơn nhiều mức 5-10% dự kiến trình Lãnh đạo phê duyệt) với chi phí API 0 đồng.",
    )


def build_slide_10_trust_security(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 10,
        "04", "TIN CẬY, BẢO MẬT & PHÁP LÝ",
        "7 cờ nghi vấn, bảo mật OWASP và bằng chứng pháp lý SHA-256",
        "Kiểm soát chặt gian lận vị trí, tuân thủ Luật BVDLCN 91/2025/QH15 và chủ động giám sát lỗi nội bộ (cập nhật 25/11).",
    )

    add_textbox(slide, 0.60, 1.62, 6.80, 0.28, "7 CỜ NGHI VẤN TỰ ĐỘNG (PHÁT HIỆN Ở MÁY CHỦ VÀ APP)", size_pt=10.2, bold=True, color=C_BRAND)

    flags = [
        ("1. Giả lập vị trí", "Phát hiện ứng dụng giả lập GPS trên Android."),
        ("2. Sai số GPS lớn", "Vị trí có độ sai số lớn hơn 50 m (cấu hình được)."),
        ("3. Lệch giờ thiết bị", "Giờ điện thoại lệch giờ máy chủ quá 5 phút."),
        ("4. Xa đại lý", "Chụp ảnh cách toạ độ đại lý quá 200 m; bắt nhập lý do."),
        ("5. Khác phố đại lý", "Đại lý chưa có toạ độ, địa chỉ chụp khác tên phố danh mục."),
        ("6. Di chuyển phi lý", "Tốc độ giữa 2 lượt liền nhau vượt 120 km/h."),
        ("7. Máy root / jailbreak", "Thiết bị đã can thiệp hệ thống (ẩn báo với nhân viên)."),
    ]
    fw = 3.28
    fh = 0.86
    with anim.wave(100, 360):
        for idx, (fname, fdesc) in enumerate(flags):
            col = idx % 2
            row = idx // 2
            fx = 0.60 + col * (fw + 0.22)
            fy = 1.98 + row * (fh + 0.14)
            card_w = fw * 2 + 0.22 if idx == 6 else fw
            add_rect(slide, fx, fy, card_w, fh, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=0.9, rounded=True, radius=0.08)
            add_rect(slide, fx, fy + 0.12, 0.07, fh - 0.24, fill_color=C_YELLOW if idx < 5 else C_RED)
            add_textbox(slide, fx + 0.18, fy + 0.10, card_w - 0.28, 0.26, fname, size_pt=10.8, bold=True, color=C_BLACK)
            add_textbox(slide, fx + 0.18, fy + 0.38, card_w - 0.28, 0.42, fdesc, size_pt=9.5, color=C_TEXT_MUTED, line_spacing=1.18)

    with anim.wave(260, 340):
        add_rect(slide, 0.60, 6.06, 6.78, 0.74, fill_color=C_YELLOW_SOFT, line_color=C_YELLOW, line_pt=1.2, rounded=True, radius=0.10)
        add_pill(slide, 0.78, 6.28, 1.55, 0.30, "NGUYÊN TẮC", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=9.0)
        add_textbox(
            slide, 2.46, 6.10, 4.78, 0.66,
            "Cờ nghi vấn dùng để quản lý xem lại, không phải để phạt.\nMọi lượt check-in đều được ghi nhận, không chặn công việc.",
            size_pt=10.2, bold=True, color=C_BLACK, line_spacing=1.22, valign=MSO_ANCHOR.MIDDLE,
        )

    # Cột phải: 4 lớp bảo vệ cập nhật đúng 25/11 (A2b, D6, F9, D8)
    add_textbox(slide, 7.66, 1.62, 5.07, 0.28, "4 LỚP BẢO VỆ KỸ THUẬT & PHÁP LÝ (CẬP NHẬT 25/11)", size_pt=10.2, bold=True, color=C_BRAND)

    layers = [
        (
            "LỚP 1",
            "Ảnh giờ máy chủ & Thiết bị linh hoạt (A2b, A2c)",
            "Ảnh chụp trong app in giờ máy chủ chống chỉnh giờ. Mặc định đăng nhập dùng ngay trên máy mới (vẫn ghi nhật ký thiết bị); bật tham số Duyệt máy mới khi cần siết 1 máy/người.",
        ),
        (
            "LỚP 2",
            "Bảo mật OWASP Top 10 & Kiểm phạm vi (D6)",
            "Header CSP, X-Frame-Options, Permissions-Policy; chặn dò mật khẩu theo IP (30 lần/15p qua Redis); kiểm tự động 17 model phạm vi (pnpm check:scope); mã hoá FAST bằng AES-256-GCM.",
        ),
        (
            "LỚP 3",
            "AuditLog & Tự giám sát lỗi nội bộ (F9)",
            "Mọi thao tác tạo, sửa, xoá, duyệt (kể cả làm thay) ghi nhật ký. Lỗi Web, App JS, Worker tự gom về /quan-tri/loi-he-thong (bỏ Sentry, dữ liệu không ra ngoài) để ĐMST&CĐS xử lý sớm.",
        ),
        (
            "LỚP 4",
            "Bằng chứng Luật BVDLCN 91/2025/QH15 (D8)",
            "Sổ đồng ý chỉ ghi thêm (DB trigger cấm sửa/xoá), nối chuỗi băm SHA-256; in/chia sẻ giấy xác nhận PDF, tra cứu công khai tại /kiem-chung-dong-y và xuất Excel quản trị.",
        ),
    ]
    lx = 7.66
    lw = 5.07
    for i, (ltag, lhead, lbody) in enumerate(layers):
        ly = 1.98 + i * 1.22
        with anim.wave(240 + i * 95, 340):
            add_rect(slide, lx, ly, lw, 1.12, fill_color=C_WHITE, line_color=C_BRAND_20, line_pt=1.0, rounded=True, radius=0.07)
            add_pill(slide, lx + 0.14, ly + 0.12, 0.78, 0.24, ltag, bg_color=C_BRAND if i < 3 else C_TECH_BG, text_color=C_WHITE if i < 3 else C_TECH_MINT, size_pt=8.4)
            add_textbox(slide, lx + 1.00, ly + 0.10, lw - 1.12, 0.28, lhead, size_pt=10.8, bold=True, color=C_BRAND_DARK)
            add_textbox(slide, lx + 0.14, ly + 0.40, lw - 0.28, 0.68, lbody, size_pt=9.2, color=C_BLACK, line_spacing=1.18)

    anim.apply()
    add_notes(
        slide,
        "Điểm nhấn công nghệ và pháp lý cập nhật ngày 25/11: "
        "(1) A2b đổi mặc định không chặn máy mới để CBNV đổi máy không bị gián đoạn; "
        "(2) D6 đã rà OWASP Top 10, thêm header bảo mật và chặn đăng nhập sai theo IP; "
        "(3) F9 tự ghi lỗi Web/App/Worker vào CSDL nội bộ giúp Phòng ĐMST&CĐS chủ động phát hiện bug; "
        "(4) D8 sổ đồng ý SHA-256 nối chuỗi tuân thủ Luật BVDLCN 91/2025/QH15.",
    )


def build_slide_11_web_operations(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 11,
        "05", "TRẢI NGHIỆM WEB TÁC NGHIỆP",
        "Bản đồ hành trình thật, Tìm nhanh Ctrl+K và Hỗ trợ chủ động SLA",
        "Ảnh chụp thật màn hình Bản đồ hành trình tại Hà Nội (12/11/2026); 27 trang responsive mượt tới điện thoại 375 px (D7).",
    )

    bx, by, bw = 0.60, 1.66, 7.12
    with anim.wave(100, 380):
        # Ảnh chụp thật trang /kinh-doanh/check-in?tab=ban-do trong khung trình duyệt công nghệ
        if assets.has_screenshot("web_checkin_map"):
            assets.add_browser_screenshot(
                slide, "web_checkin_map", bx, by, bw,
                "seedgw.vinaseed.com.vn/kinh-doanh/check-in?tab=ban-do",
                badge_text="ẢNH CHỤP THẬT",
            )

    with anim.wave(220, 360):
        # Dải số liệu chạy thử thực tế ngay dưới ảnh bản đồ (Dark-Tech card)
        add_rect(slide, bx, 5.68, bw, 1.14, fill_color=C_TECH_BG, line_color=C_BRAND, line_pt=1.1, rounded=True, radius=0.07)
        add_pill(slide, bx + 0.16, 5.79, 2.75, 0.23, "KẾT QUẢ CHẠY THỬ THỰC TẾ", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=8.0)
        add_textbox(slide, bx + 3.04, 5.79, 3.92, 0.23, "1 người tự chạy thử ngoài thị trường (3 ngày)", size_pt=8.6, color=C_BRAND_20, align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE)

        stats_real = [
            ("15 lượt", "Ghé thăm đại lý / điểm thực địa", C_TECH_MINT),
            ("68,758 km", "34,288 + 10,767 + 23,703 km", C_YELLOW),
            ("34,321 km", "Hành trình thật 12/11 trên ảnh", C_WHITE),
        ]
        sw_box = 2.18
        for si, (sval, slbl, scol) in enumerate(stats_real):
            sx = bx + 0.16 + si * (sw_box + 0.13)
            add_rect(slide, sx, 6.08, sw_box, 0.64, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=0.7, rounded=True, radius=0.08)
            add_textbox(slide, sx + 0.10, 6.11, sw_box - 0.20, 0.30, sval, size_pt=14.2, bold=True, color=scol)
            add_textbox(slide, sx + 0.10, 6.42, sw_box - 0.20, 0.24, slbl, size_pt=8.0, color=C_BRAND_20)

    # Cột phải: 4 khối nghiệp vụ web tác nghiệp
    web_ops = [
        (
            "Báo cáo ghé thăm, Bản đồ & Xuất Excel CTP",
            "Xem vết đường thực tế, điểm bắt đầu/kết thúc, đoạn đứt, ảnh chụp kèm địa chỉ, 2 cột km (đường đi OSRM và GPS) và xuất Excel đúng mẫu thanh toán CTP.",
            C_BRAND,
        ),
        (
            "Tìm nhanh Ctrl+K & Trung tâm thông báo (D3, D4)",
            "Bấm Ctrl+K ở mọi trang để tìm nhanh trang, đại lý, khách hàng, tài khoản, mã Hỗ trợ theo phạm vi. Chuông thông báo & /thong-bao cập nhật tức thì.",
            C_OLIVE,
        ),
        (
            "Lập tuyến, Chỉ tiêu & Duyệt ĐL mới (S8, K3, M10b)",
            "NVKD đăng ký tuyến tuần/ngày trên Web; Lãnh đạo giao chỉ tiêu tháng; duyệt 2 cấp Tuyến/Chỉ tiêu và duyệt 1 bước Đại lý mới ngay tại Cần duyệt.",
            C_BRAND_80,
        ),
        (
            "Hỗ trợ chủ động có SLA từ Phòng ĐMST&CĐS",
            "Nút nổi xanh ở góc dưới mọi trang web tự gắn URL và ảnh chụp màn hình. Báo lỗi chặn việc phản hồi trong 1h, xử lý trong 4h làm việc.",
            C_YELLOW,
        ),
    ]
    rx = 7.94
    rw = 4.79
    for i, (whead, wdesc, wcol) in enumerate(web_ops):
        ry = 1.66 + i * 1.32
        with anim.wave(240 + i * 85, 340):
            add_rect(slide, rx, ry, rw, 1.20, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
            add_rect(slide, rx, ry + 0.12, 0.08, 0.96, fill_color=wcol)
            add_textbox(slide, rx + 0.18, ry + 0.11, rw - 0.30, 0.28, whead, size_pt=11.0, bold=True, color=C_BRAND)
            add_textbox(slide, rx + 0.18, ry + 0.42, rw - 0.30, 0.72, wdesc, size_pt=9.5, color=C_TEXT_MUTED, line_spacing=1.20)

    anim.apply()
    add_notes(
        slide,
        "Ảnh chụp thật màn hình Bản đồ hành trình /kinh-doanh/check-in?tab=ban-do ngày 12/11/2026 tại Hà Nội: "
        "3 điểm check-in thực tế, 34,321 km GPS giữa các lượt (36,965 km cả ngày). Kèm tổng kết 3 chuyến tự chạy thử: 15 lượt / 68,758 km.",
    )


def build_slide_12_data_hygiene(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 12,
        "05", "CHUẨN HOÁ DỮ LIỆU THỊ TRƯỜNG",
        "Làm sạch 15.819 đại lý cũ và mở rộng Khách hàng nông dân/HTX",
        "Quản lý dữ liệu khách hàng - đại lý tập trung, không trùng lặp, tổ chức chuẩn theo 7 vùng canh tác và 34 tỉnh mới.",
    )

    with anim.wave(100, 380):
        # Khối trên: Thực trạng 15.819 đại lý từ hệ thống cũ
        add_rect(slide, 0.60, 1.64, 12.133, 2.40, fill_color=C_WHITE, line_color=C_BRAND_20, line_pt=1.0, rounded=True, radius=0.06)
        add_textbox(
            slide, 0.84, 1.76, 11.60, 0.28,
            "THỰC TRẠNG DỮ LIỆU THẬT ĐÃ NẠP VÀO MÁY CHỦ THỬ (15.819 ĐẠI LÝ, 19 ĐƠN VỊ + 3 ĐƠN VỊ MỚI CỦA SSC)",
            size_pt=10.2, bold=True, color=C_BRAND,
        )

        bars = [
            ("Đã ghép nhân viên phụ trách", 9464, 15819, "9.464 đại lý (59,8%)", C_BRAND, "Còn 2.615 chờ gán (74 tên cũ không có trong DS NV)"),
            ("Đã có mã khách hàng FAST", 3219, 15819, "3.219 đại lý (20,3%)", C_OLIVE, "Cần đối chiếu khi nối API FAST 2 chiều"),
            ("Số điện thoại sai định dạng", 2577, 15819, "2.577 số (16,3%)", C_YELLOW, "Đã chia nhóm: số rác, thiếu số, dư số để dọn hàng loạt"),
            ("Người phụ trách ngoài địa bàn", 768, 15819, "768 đại lý (4,9%)", C_RED, "Có bộ lọc Ngoài địa bàn đơn vị để các đơn vị rà lại"),
        ]
        for idx, (label, val, total, metric, color, note) in enumerate(bars):
            by = 2.16 + idx * 0.45
            add_textbox(slide, 0.84, by, 3.05, 0.30, label, size_pt=10.3, bold=True, color=C_BLACK)
            bar_x, bar_w = 3.96, 3.55
            add_rect(slide, bar_x, by + 0.06, bar_w, 0.18, fill_color=C_SURFACE_SUBTLE, line_color=C_BORDER, line_pt=0.6, rounded=True, radius=0.35)
            fill_w = max(0.18, bar_w * (val / total))
            add_rect(slide, bar_x, by + 0.06, fill_w, 0.18, fill_color=color, rounded=True, radius=0.35)
            add_textbox(slide, 7.64, by, 1.72, 0.30, metric, size_pt=10.0, bold=True, color=C_BRAND_DARK if color != C_RED else C_RED)
            add_textbox(slide, 9.38, by, 3.20, 0.30, note, size_pt=9.1, color=C_TEXT_MUTED)

    # 4 thẻ công cụ làm sạch & mở rộng Khách hàng S1 (cập nhật đúng M10b & S1)
    tools = [
        (
            "K7  -  7 vùng & 34 tỉnh mới",
            "Chuẩn hoá 63 tỉnh cũ sang 34 tỉnh theo NQ 202/2025/QH15. Gắn 18 mùa vụ theo vùng canh tác và phân công tỉnh phụ trách từng đơn vị.",
            "/quan-tri/vung-tinh",
        ),
        (
            "A7b  -  Gộp trùng & sửa SĐT sai",
            "Gộp đại lý trùng SĐT/MST: tự chuyển check-in, tuyến, đại lý con sang bản giữ; giữ nguyên lịch sử gộp. Chặn gộp 2 đại lý cùng có mã FAST.",
            "/quan-tri/dai-ly/trung",
        ),
        (
            "M4 & M10b  -  Toạ độ & ĐL mới",
            "Check-in đầu tự đề xuất toạ độ; đề xuất ĐL mới từ app tự lấy GPS & địa chỉ, cảnh báo trùng trong 100 m và chuyển Quản lý/Lãnh đạo duyệt 1 bước.",
            "/kinh-doanh/can-duyet",
        ),
        (
            "S1  -  Khách hàng nông dân & HTX",
            "Đã hoàn thiện 25/11: mã KH00001, lưu cây trồng, diện tích (ha), tối đa 10 đại lý hay mua. App chọn trực tiếp khi check-in và tự ghi toạ độ lần đầu.",
            "/kinh-doanh/khach-hang",
        ),
    ]
    tw = 2.86
    tgap = 0.23
    for i, (thead, tdesc, turl) in enumerate(tools):
        tx = 0.60 + i * (tw + tgap)
        with anim.wave(280 + i * 85, 340):
            add_rect(slide, tx, 4.24, tw, 2.58, fill_color=C_WHITE, line_color=C_YELLOW if i == 3 else C_BORDER_TECH, line_pt=1.1 if i == 3 else 1.0, rounded=True, radius=0.07)
            add_card_top_accent(slide, tx, 4.24, tw, 2.58, 0.07, fill_color=C_YELLOW if i == 3 else (C_BRAND if i % 2 == 0 else C_OLIVE))
            add_textbox(slide, tx + 0.16, 4.42, tw - 0.32, 0.40, thead, size_pt=11.4, bold=True, color=C_BRAND)
            add_textbox(slide, tx + 0.16, 4.86, tw - 0.32, 1.50, tdesc, size_pt=9.8, color=C_TEXT_MUTED, line_spacing=1.22)
            add_pill(slide, tx + 0.16, 6.44, tw - 0.32, 0.26, turl, bg_color=C_BRAND_05 if i == 3 else C_SURFACE_SUBTLE, text_color=C_BRAND if i == 3 else C_TEXT_MUTED, size_pt=8.4, bold=(i == 3))

    anim.apply()
    add_notes(
        slide,
        "Nhấn mạnh 2 cập nhật mới 25/11: S1 Khách hàng nông dân & HTX đã lên máy chủ thử (không còn chờ nhánh) và "
        "M10b chuyển duyệt đại lý mới về 1 bước cho Quản lý/Lãnh đạo đơn vị cùng trang /kinh-doanh/dai-ly/de-xuat cho NVKD theo dõi.",
    )


def build_slide_13_dashboard_executive(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 13,
        "06", "DASHBOARD & ĐIỀU HÀNH",
        "Ảnh chụp thật Dashboard & Tổng quan, tải cả năm chỉ 0,64 giây",
        "Bộ lọc Từ ngày - Đến ngày (K8) theo đúng thời gian lãnh đạo mong muốn; nền gộp K1 & phân vùng GPS D5 tải siêu nhanh.",
    )

    # Nửa trên: Song song 2 ảnh chụp Web THẬT (Dashboard Kinh doanh & Tổng quan điều hành)
    with anim.wave(100, 380):
        if assets.has_screenshot("web_dashboard"):
            assets.add_browser_screenshot(
                slide, "web_dashboard", 0.60, 1.64, 5.95,
                "seedgw.vinaseed.com.vn/kinh-doanh/dashboard",
                badge_text="DASHBOARD THẬT",
            )
    with anim.wave(220, 380):
        if assets.has_screenshot("web_executive"):
            assets.add_browser_screenshot(
                slide, "web_executive", 6.78, 1.64, 5.95,
                "seedgw.vinaseed.com.vn/tong-quan",
                badge_text="TỔNG QUAN THẬT",
            )

    # Nửa dưới: 3 thẻ trọng tâm (Thực chứng hiệu năng K1 & D5 + Bộ lọc K8 + Báo cáo K5)
    by = 5.06
    bh = 1.78

    with anim.wave(340, 360):
        # Thẻ 1: Dark-Tech Thực chứng hiệu năng K1 & D5
        c1w = 4.65
        add_rect(slide, 0.60, by, c1w, bh, fill_color=C_TECH_BG, line_color=C_BRAND, line_pt=1.2, rounded=True, radius=0.07)
        add_pill(slide, 0.78, by + 0.12, 2.85, 0.23, "THỰC CHỨNG HIỆU NĂNG (K1 & D5)", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=8.0)

        add_rect(slide, 0.78, by + 0.42, 2.08, 0.74, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=0.8, rounded=True, radius=0.08)
        add_textbox(slide, 0.88, by + 0.44, 1.90, 0.34, "0,64 giây", size_pt=17.5, bold=True, color=C_TECH_MINT)
        add_textbox(slide, 0.88, by + 0.78, 1.90, 0.34, "Dashboard 1 năm (720.004 lượt, nhanh gấp 5 lần)", size_pt=7.8, color=C_BRAND_20, line_spacing=1.12)

        add_rect(slide, 2.98, by + 0.42, 2.10, 0.74, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=0.8, rounded=True, radius=0.08)
        add_textbox(slide, 3.08, by + 0.44, 1.92, 0.34, "15 - 25 ms", size_pt=17.5, bold=True, color=C_YELLOW)
        add_textbox(slide, 3.08, by + 0.78, 1.92, 0.34, "Đọc vết 1 ngày trên 6,48 triệu điểm GPS (D5)", size_pt=7.8, color=C_BRAND_20, line_spacing=1.12)

        add_textbox(
            slide, 0.78, by + 1.24, c1w - 0.34, 0.46,
            "Bảng gộp daily_visit_stats (0 dòng lệch) + chia bảng GPS theo tháng (xoá 1 tháng 3,24 triệu điểm chỉ 75 ms).",
            size_pt=8.8, color=C_BRAND_20, line_spacing=1.18,
        )

    with anim.wave(430, 340):
        # Thẻ 2: Bộ lọc Từ ngày - Đến ngày (K8)
        c2x = 5.45
        c2w = 3.55
        add_rect(slide, c2x, by, c2w, bh, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
        add_card_top_accent(slide, c2x, by, c2w, bh, 0.07, fill_color=C_BRAND)
        add_textbox(slide, c2x + 0.16, by + 0.18, c2w - 0.32, 0.28, "Bộ lọc Từ ngày - Đến ngày (K8)", size_pt=11.0, bold=True, color=C_BRAND)
        add_textbox(
            slide, c2x + 0.16, by + 0.50, c2w - 0.32, 1.18,
            "Thay các nút chọn kỳ cố định bằng khoảng ngày tự chọn dd/mm/yyyy (tối đa 366 ngày) trên Tổng quan, Dashboard, Báo cáo và Hỗ trợ. Khoảng trọn tháng tự so % chỉ tiêu; lọc Vùng/Tỉnh giữ nguyên khi chuyển trang.",
            size_pt=9.3, color=C_TEXT_MUTED, line_spacing=1.20,
        )

    with anim.wave(520, 340):
        # Thẻ 3: Từ tổng quan tới chi tiết & Xuất Excel (K5)
        c3x = 9.20
        c3w = 3.533
        add_rect(slide, c3x, by, c3w, bh, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
        add_card_top_accent(slide, c3x, by, c3w, bh, 0.07, fill_color=C_OLIVE)
        add_textbox(slide, c3x + 0.16, by + 0.18, c3w - 0.32, 0.28, "Báo cáo đa chiều & Xuất Excel (K5)", size_pt=11.0, bold=True, color=C_BRAND)
        add_textbox(
            slide, c3x + 0.16, by + 0.50, c3w - 0.32, 1.18,
            "Ảnh chụp thật từ máy chủ thử (số liệu đợt tự chạy thử ban đầu). Trang /kinh-doanh/bao-cao xem đủ 3 góc nhìn: Theo nhân viên, Theo đơn vị (gồm đơn vị con) và Theo đại lý, kèm xuất Excel đúng phạm vi.",
            size_pt=9.3, color=C_TEXT_MUTED, line_spacing=1.20,
        )

    anim.apply()
    add_notes(
        slide,
        "Trình chiếu trực tiếp 2 ảnh chụp màn hình Web thật (26/11/2026): Dashboard Kinh doanh (/kinh-doanh/dashboard) và Tổng quan điều hành (/tong-quan) "
        "với bộ lọc Từ ngày - Đến ngày (K8), Tìm nhanh Ctrl+K, 7 vùng canh tác, So sánh đơn vị và Mục Cần chú ý. Nói rõ số liệu hiện tại trên ảnh là dữ liệu đợt 1 người tự chạy thử.",
    )


def build_slide_14_architecture_scale(prs: Presentation, assets: BrandAssets) -> None:
    """Slide Kiến trúc Công nghệ theo phong cách Dark-Tech Blueprint nổi bật."""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "med")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 14,
        "07", "KIẾN TRÚC CÔNG NGHỆ & HẠ TẦNG",
        "Kiến trúc hiện đại, tự chủ hạ tầng cho 300-400 người dùng",
        "Đóng gói Docker Compose toàn diện, hàng đợi nền BullMQ (F8), phân vùng GPS theo tháng (D5) và tự giám sát lỗi nội bộ (F9).",
        dark=True,
    )

    tiers = [
        (
            "TẦNG 1  -  ỨNG DỤNG NGƯỜI DÙNG",
            C_BRAND,
            [
                ("Web Next.js 15 + React 19", "Server Components, Auth.js, biểu đồ Recharts, bản đồ Leaflet, Ctrl+K, SSE realtime Hỗ trợ, responsive 27 trang."),
                ("App Expo v0.2.0 (Android & iPhone)", "3 tab tinh gọn SQLite offline-first, GPS 5s chạy nền, máy ảnh in dấu, hỗ trợ chữ to, cập nhật OTA expo-updates."),
            ],
        ),
        (
            "TẦNG 2  -  CỔNG BẢO MẬT & WORKER",
            C_OLIVE,
            [
                ("Caddy HTTPS + OWASP + Rate-Limit", "Một cổng vào duy nhất, tự cấp chứng chỉ HTTPS, header CSP/X-Frame-Options, chặn dò mật khẩu Redis theo IP."),
                ("Worker BullMQ + Redis + OSRM 5.27", "Hàng đợi F8 xử lý km/địa chỉ có retry 5 lần, khớp đường xe máy OSRM nội bộ, Vietmap, Expo Push, đồng bộ FAST."),
            ],
        ),
        (
            "TẦNG 3  -  DỮ LIỆU & TÍCH HỢP",
            C_BRAND_90,
            [
                ("PostgreSQL 16 + MinIO (S3)", "Bảng gộp K1, bảng GPS chia theo tháng D5, sổ đồng ý SHA-256 (D8), error_logs (F9); MinIO tự xoá ảnh sau 45 ngày."),
                ("Kết nối FAST Business Online v1.7", "Trang /quan-tri/ket-noi sẵn sàng, mã hoá AES-256-GCM, đồng bộ 5 phút/lần, lưu lịch sử & dòng lỗi chi tiết."),
            ],
        ),
    ]

    tw = 3.82
    tgap = 0.336
    for i, (tname, tcol, tblocks) in enumerate(tiers):
        tx = 0.60 + i * (tw + tgap)
        with anim.wave(100 + i * 120, 360):
            add_rect(slide, tx, 1.66, tw, 3.16, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=1.1, rounded=True, radius=0.06)
            add_card_header(slide, tx, 1.66, tw, 0.44, 3.16, 0.06, fill_color=tcol)
            add_textbox(slide, tx + 0.14, 1.74, tw - 0.28, 0.28, tname, size_pt=10.0, bold=True, color=C_WHITE)
            for bi, (bh, bd) in enumerate(tblocks):
                by = 2.22 + bi * 1.26
                add_rect(slide, tx + 0.14, by, tw - 0.28, 1.14, fill_color=C_TECH_BG, line_color=C_BRAND_80, line_pt=0.8, rounded=True, radius=0.06)
                add_textbox(slide, tx + 0.24, by + 0.08, tw - 0.48, 0.26, bh, size_pt=10.5, bold=True, color=C_TECH_MINT)
                add_textbox(slide, tx + 0.24, by + 0.36, tw - 0.48, 0.72, bd, size_pt=9.2, color=C_BRAND_20, line_spacing=1.18)
            if i < 2:
                add_arrow_right(slide, tx + tw + 0.06, 3.08, 0.22, 0.28, fill_color=C_YELLOW)

    # 4 thẻ thông số quy mô & làm chủ công nghệ ở đáy
    bottom_cards = [
        ("~42.000 lượt / tháng", "Dự kiến 300 NVKD x 5,4 lượt x 26 ngày; đã chứng minh tải 720.004 lượt/năm chỉ 0,64s.", C_TECH_MINT),
        ("6,48 triệu điểm GPS", "Chia bảng theo tháng (D5): đọc 15-25 ms, tự dọn 02:00 đêm; kho ảnh ổn định ~19 GB.", C_YELLOW),
        ("1 máy chủ Ubuntu IT", "Gợi ý: 8 vCPU, 16-32 GB RAM, 1 TB SSD; sẵn backup.sh, restore.sh và tài liệu chuyển giao.", C_OLIVE),
        ("100% ĐMST&CĐS làm chủ", "Tự giám sát lỗi nội bộ F9 (không gửi dữ liệu ra ngoài), chủ động sửa & nâng cấp tức thì.", C_YELLOW),
    ]
    bw = 2.86
    bgap = 0.23
    for i, (bhead, bdesc, bcol) in enumerate(bottom_cards):
        bx = 0.60 + i * (bw + bgap)
        with anim.wave(460 + i * 80, 320):
            add_rect(slide, bx, 5.04, bw, 1.78, fill_color=C_TECH_PANEL, line_color=C_YELLOW if i == 3 else C_BRAND_90, line_pt=1.1 if i == 3 else 0.9, rounded=True, radius=0.07)
            add_card_top_accent(slide, bx, 5.04, bw, 1.78, 0.07, fill_color=bcol)
            add_textbox(slide, bx + 0.16, 5.22, bw - 0.32, 0.34, bhead, size_pt=12.0, bold=True, color=bcol)
            add_textbox(slide, bx + 0.16, 5.60, bw - 0.32, 1.12, bdesc, size_pt=9.6, color=C_BRAND_20, line_spacing=1.22)

    anim.apply()
    add_notes(
        slide,
        "Slide kiến trúc dạng Dark-Tech nhấn mạnh năng lực kỹ thuật đã kiểm chứng: không chỉ chạy thử mà đã phân vùng dữ liệu (D5), "
        "xử lý hàng đợi bất đồng bộ (F8) và tự giám sát lỗi (F9), chi phí máy chủ hợp lý và tự chủ hoàn toàn.",
    )


def build_slide_15_gaps_improvements(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 15,
        "08", "MINH BẠCH HIỆN TRẠNG",
        "Phần chờ kết nối FAST và các việc còn lại trước Go-live",
        "12 hạng mục nền tảng (S1, M12, K8, M10b, D3-D8, F8-F9) đã hoàn tất sớm 25/11; báo cáo thẳng phần còn phụ thuộc.",
    )

    with anim.wave(100, 360):
        # Cột trái: Phần chờ kết nối FAST & Giai đoạn sau
        add_rect(slide, 0.60, 1.66, 5.92, 5.14, fill_color=C_WHITE, line_color=C_YELLOW, line_pt=1.3, rounded=True, radius=0.06)
        add_card_header(slide, 0.60, 1.66, 5.92, 0.46, 5.14, 0.06, fill_color=C_YELLOW)
        add_textbox(slide, 0.80, 1.74, 5.52, 0.30, "PHẦN CHỜ KẾT NỐI FAST & ĐỊNH HƯỚNG GIAI ĐOẠN SAU", size_pt=11.4, bold=True, color=C_BLACK)
        add_textbox(
            slide, 0.80, 2.24, 5.52, 0.54,
            "Trang /quan-tri/ket-noi đã sẵn theo đặc tả API v1.7 và thử với máy chủ giả lập. Còn chờ FAST cấp tài khoản API và trả lời 14 câu hỏi kỹ thuật:",
            size_pt=10.0, color=C_TEXT_MUTED, line_spacing=1.20,
        )

        fast_gaps = [
            ("Đồng bộ đại lý 2 chiều (Ưu tiên 1)", "FAST sang SeedGW mỗi 5 phút; ĐL mới duyệt trên SeedGW tự cấp mã dải DL đẩy sang FAST và đồng bộ sửa đổi.", "Chờ FAST"),
            ("Thực bán (kg) & Công nợ hạn mức", "Đang bật cờ tạm ẩn (features.ts); sẽ mở lại trên Dashboard, Báo cáo và hồ sơ ĐL khi có API hoá đơn/công nợ FAST.", "Tạm hold"),
            ("Phương án dự phòng độc lập", "Nếu FAST chưa mở API kịp, SeedGW vẫn vận hành hoàn toàn độc lập và đối soát qua nhập/xuất Excel định kỳ.", "Chủ động"),
            ("Đặt hàng & Duyệt đơn (Giai đoạn tiếp theo)", "Đợt này tập trung làm thật ổn định Thị trường & CTP (tránh lỗi ôm đồm của DMS cũ); triển khai Đơn hàng khi được duyệt đầu tư.", "Giai đoạn sau"),
        ]
        for i, (ftitle, fdesc, fbadge) in enumerate(fast_gaps):
            fy = 2.86 + i * 0.94
            is_alt = i == 2
            add_rect(slide, 0.80, fy, 5.52, 0.84, fill_color=C_BRAND_05 if is_alt else C_SURFACE_SUBTLE, rounded=True, radius=0.08)
            add_textbox(slide, 0.94, fy + 0.08, 3.85, 0.24, ftitle, size_pt=10.6, bold=True, color=C_BRAND if is_alt else C_BLACK)
            add_pill(
                slide, 5.02, fy + 0.08, 1.18, 0.24, fbadge,
                bg_color=C_BRAND_10 if is_alt else C_YELLOW_SOFT,
                text_color=C_BRAND if is_alt else C_BLACK, size_pt=8.2,
            )
            add_textbox(slide, 0.94, fy + 0.34, 5.24, 0.46, fdesc, size_pt=9.4, color=C_TEXT_MUTED, line_spacing=1.18)

    with anim.wave(240, 360):
        # Cột phải: Các việc còn lại trước Go-live (cập nhật đã bỏ các việc D3-D8, F8-F9, S1 đã làm xong!)
        add_rect(slide, 6.81, 1.66, 5.92, 5.14, fill_color=C_WHITE, line_color=C_BRAND_20, line_pt=1.2, rounded=True, radius=0.06)
        add_card_header(slide, 6.81, 1.66, 5.92, 0.46, 5.14, 0.06, fill_color=C_BRAND)
        add_textbox(slide, 7.01, 1.74, 5.52, 0.30, "CÁC HẠNG MỤC CẦN HOÀN TẤT TRƯỚC GO-LIVE", size_pt=11.4, bold=True, color=C_WHITE)

        tech_gaps = [
            ("Chuyển lên máy chủ IT Vinaseed (F7)", "Hiện chạy tạm trên máy cá nhân qua Cloudflare Tunnel (địa chỉ đổi khi khởi động lại). Cần máy chủ Ubuntu cố định & tên miền riêng.", "Ưu tiên"),
            ("Kiểm thử thực tế trên điện thoại & Tải API", "Thử toàn bộ gói 25/11 (App 3 tab M12, Khách hàng S1, Đồng ý D8, chữ to D7) trên Android/iPhone thật, thử tải API và truy cập chéo.", "T12/2026"),
            ("Phát hành App chính thức & Hồ sơ Pháp chế", "Đưa bản iPhone qua TestFlight / Apple Business Manager, Android chính thức; Pháp chế rà soát mẫu đồng ý theo Luật BVDLCN (D8).", "T1 - T2/2027"),
            ("Đơn vị phối hợp làm sạch danh mục cũ", "Rà soát gộp đại lý trùng, dọn 2.577 SĐT sai, 768 đại lý ngoài địa bàn và gán nhân viên phụ trách cho 2.615 đại lý chờ gán.", "T12 - T2/2027"),
        ]
        for i, (ttitle, tdesc, twhen) in enumerate(tech_gaps):
            ty = 2.26 + i * 0.98
            add_rect(slide, 7.01, ty, 5.52, 0.88, fill_color=C_BRAND_05, line_color=C_BRAND_20, line_pt=0.7, rounded=True, radius=0.08)
            add_textbox(slide, 7.15, ty + 0.08, 3.85, 0.24, ttitle, size_pt=10.6, bold=True, color=C_BRAND_DARK)
            add_pill(slide, 11.12, ty + 0.08, 1.28, 0.24, twhen, bg_color=C_WHITE, text_color=C_BRAND, size_pt=8.2, line_color=C_BRAND_20)
            add_textbox(slide, 7.15, ty + 0.34, 5.24, 0.50, tdesc, size_pt=9.4, color=C_TEXT_MUTED, line_spacing=1.18)

        # Thanh tóm tắt đã hoàn thành sớm 25/11
        add_rect(slide, 7.01, 6.22, 5.52, 0.46, fill_color=C_TECH_BG, rounded=True, radius=0.14)
        add_textbox(
            slide, 7.15, 6.22, 5.24, 0.46,
            "Đã hoàn tất sớm 25/11: S1, M12, M10b, K8, A2b-c, D3-D8, F8-F9 (đã lên máy chủ thử).",
            size_pt=9.3, bold=True, color=C_TECH_MINT, valign=MSO_ANCHOR.MIDDLE,
        )

    anim.apply()
    add_notes(
        slide,
        "Minh bạch hoàn toàn với Ban Lãnh đạo: các phần kỹ thuật khó như phân vùng GPS (D5), hàng đợi nền (F8), tự ghi lỗi (F9), "
        "bảo mật OWASP (D6), Khách hàng S1 và App 3 tab M12 đều đã xong sớm 25/11. Phần còn lại chủ yếu là thử nghiệm thực tế, máy chủ IT và API FAST.",
    )


def build_slide_16_roadmap(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "push", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 16,
        "09", "LỘ TRÌNH TRIỂN KHAI",
        "Từ giải pháp thay thế từng bước tới ứng dụng chính thức toàn công ty",
        "Kế hoạch cuốn chiếu 6 chặng rõ ràng: thí điểm ổn định trước, mở rộng toàn công ty và sẵn sàng nâng cấp khi được đầu tư.",
    )

    # Đường trục timeline ngang
    add_rect(slide, 0.85, 2.58, 11.63, 0.07, fill_color=C_BRAND_20)
    add_rect(slide, 0.85, 2.58, 2.10, 0.07, fill_color=C_BRAND)

    milestones = [
        ("27/11/2026", "Demo nội bộ", "Trình bày bản cập nhật 25/11, chốt ngưỡng sai số CTP, mở rộng nhóm thử nghiệm thực địa.", C_BRAND, True),
        ("Tháng 12", "Ổn định thực địa", "Thử sâu App 3 tab (M12), S1, D8 trên điện thoại thật; sẵn sàng thí điểm 1 đơn vị từ 14/12.", C_BRAND_90, False),
        ("28/12 - 12/01", "Kết nối FAST", "Thử API FAST, đồng bộ đại lý 2 chiều dải mã DL; mở Thực bán & công nợ theo tiến độ FAST.", C_YELLOW, False),
        ("13/01 - 05/02", "Hạ tầng & App", "Lên máy chủ IT Vinaseed (F7), thử chéo bảo mật, phát hành App iPhone (ABM/TestFlight) & Android.", C_OLIVE, False),
        ("15/02 - 26/02", "Nghiệm thu", "Nghiệm thu theo kịch bản toàn diện; đào tạo theo 5 vai trò (tuần 22/02), bàn giao vận hành IT.", C_BRAND_80, False),
        ("01/03 - 15/03", "Dùng thật", "Triển khai 3 đợt cuốn chiếu toàn công ty; đánh giá đề xuất phê duyệt ứng dụng chính thức & GĐ2.", C_BRAND_DARK, True),
    ]

    mw = 1.88
    mgap = 0.17
    for i, (date_str, mtitle, mdesc, mcol, highlight) in enumerate(milestones):
        mx = 0.60 + i * (mw + mgap)
        with anim.wave(80 + i * 80, 320):
            add_pill(
                slide, mx + 0.08, 1.90, mw - 0.16, 0.36, date_str,
                bg_color=mcol if highlight else C_BRAND_10,
                text_color=C_WHITE if highlight else C_BRAND_DARK,
                size_pt=9.4, bold=True,
            )
            add_oval(slide, mx + mw / 2 - 0.16, 2.45, 0.32, 0.32, fill_color=mcol, line_color=C_WHITE, line_pt=2.5)
            add_rect(
                slide, mx, 2.98, mw, 2.46,
                fill_color=C_WHITE,
                line_color=mcol if highlight else C_BORDER_TECH,
                line_pt=1.3 if highlight else 0.9,
                rounded=True, radius=0.07,
            )
            add_card_top_accent(slide, mx, 2.98, mw, 2.46, 0.07, fill_color=mcol)
            add_textbox(slide, mx + 0.12, 3.16, mw - 0.24, 0.34, mtitle, size_pt=12.0, bold=True, color=C_BRAND_DARK if mcol == C_YELLOW else mcol)
            add_textbox(slide, mx + 0.12, 3.54, mw - 0.24, 1.80, mdesc, size_pt=9.6, color=C_TEXT_MUTED, line_spacing=1.24)

    # Dải Go-live 3 đợt ở đáy (Dark-Tech banner)
    with anim.wave(560, 380):
        add_rect(slide, 0.60, 5.68, 12.133, 1.12, fill_color=C_TECH_BG, line_color=C_BRAND, line_pt=1.1, rounded=True, radius=0.08)
        add_textbox(slide, 0.85, 5.82, 3.35, 0.30, "MỤC TIÊU GO-LIVE 3 ĐỢT", size_pt=11.2, bold=True, color=C_YELLOW)
        add_textbox(slide, 0.85, 6.14, 3.35, 0.52, "300 đến 400 người dùng thật\ntừ giữa tháng 3/2027", size_pt=10.8, bold=True, color=C_WHITE, line_spacing=1.22)

        waves = [
            ("ĐỢT 1  -  01/03/2027", "1 đơn vị thí điểm toàn bộ luồng"),
            ("ĐỢT 2  -  08/03/2027", "Mở rộng khoảng 50% số đơn vị"),
            ("ĐỢT 3  -  15/03/2027", "Toàn bộ 300-400 CBNV Vinaseed"),
        ]
        for wi, (wdate, wtxt) in enumerate(waves):
            wx = 4.35 + wi * 2.74
            add_rect(slide, wx, 5.86, 2.58, 0.76, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=0.9, rounded=True, radius=0.10)
            add_textbox(slide, wx + 0.14, 5.94, 2.30, 0.24, wdate, size_pt=9.4, bold=True, color=C_TECH_MINT)
            add_textbox(slide, wx + 0.14, 6.22, 2.30, 0.32, wtxt, size_pt=9.6, color=C_WHITE)

    anim.apply()
    add_notes(
        slide,
        "Trình bày đường găng dự án và phương án dự phòng: nếu FAST chậm sẽ đi trước phần hạ tầng & phát hành App; "
        "nếu Apple duyệt chậm thì Android ra quân trước. Theo dõi ổn định sau go-live tới 02/04/2027 và đề xuất đầu tư giai đoạn tiếp theo (Đặt hàng).",
    )


def build_slide_17_asks(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    add_slide_transition(slide, "fade", "fast")
    anim = SlideAnimator(slide)

    add_chrome(
        slide, assets, 17,
        "09", "ĐỀ NGHỊ PHỐI HỢP",
        "Để dùng thật đúng hẹn 01/03/2027, cần các bên phối hợp",
        "Các đầu việc và quyết định then chốt để hệ thống đi vào vận hành ổn định và mở rộng toàn công ty.",
    )

    asks = [
        (
            "FAST và Kế toán",
            "Hạn: 11/12/2026",
            "Cấp tài khoản API thử và thật; trả lời 14 câu hỏi kỹ thuật về hoá đơn, hàng trả lại, ghi khách hàng mới; chốt dải mã DL cho SeedGW.",
            C_RED,
        ),
        (
            "Ban Lãnh đạo & Khối Kinh doanh",
            "Sau Demo / 08/01/2027",
            "Chốt ngưỡng sai số km thanh toán CTP (vd 5-10%); chọn đơn vị thí điểm; chốt định hướng đầu tư nguồn lực nâng cấp lên ứng dụng chính thức.",
            C_YELLOW,
        ),
        (
            "Pháp chế và Hành chính",
            "Hạn: 15/01/2027",
            "Hỗ trợ tài khoản Apple Developer pháp nhân Vinaseed (D-U-N-S, ABM), Google Play và rà soát mẫu đồng ý dữ liệu cá nhân Luật BVDLCN (D8).",
            C_OLIVE,
        ),
        (
            "Phòng IT Vinaseed",
            "Hạn: 22/01/2027",
            "Cấp máy chủ Ubuntu nội bộ, tên miền seedgw.vinaseed.com.vn, mở cổng 80/443 ở DMZ, thư mục sao lưu và nhận tài liệu vận hành.",
            C_BRAND,
        ),
        (
            "Các Đơn vị và Chi nhánh",
            "Tháng 12 - 02/2027",
            "Cử nhân sự làm Quản trị đơn vị; phối hợp dọn đại lý trùng, 2.577 SĐT sai, 768 đại lý ngoài địa bàn và 2.615 đại lý chờ gán nhân viên.",
            C_BRAND_80,
        ),
        (
            "Mở rộng nhóm thử & CBNV",
            "Ngay sau Demo 27/11",
            "Từ kết quả tự chạy thử ban đầu (1 người, 15 lượt / 68,758 km), mở rộng nhóm CBNV trải nghiệm App 3 tab v0.2.0 và gửi góp ý qua nút Hỗ trợ.",
            C_BRAND_DARK,
        ),
    ]

    aw = 3.88
    ah = 2.28
    agap_x = 0.246
    agap_y = 0.24
    for idx, (who, deadline, desc, accent) in enumerate(asks):
        col = idx % 3
        row = idx // 3
        ax = 0.60 + col * (aw + agap_x)
        ay = 1.72 + row * (ah + agap_y)
        with anim.wave(80 + idx * 75, 320):
            add_rect(slide, ax, ay, aw, ah, fill_color=C_WHITE, line_color=C_BORDER_TECH, line_pt=1.0, rounded=True, radius=0.07)
            add_card_top_accent(slide, ax, ay, aw, ah, 0.07, fill_color=accent)
            add_textbox(slide, ax + 0.18, ay + 0.20, aw - 0.36, 0.34, who, size_pt=12.6, bold=True, color=C_BRAND)
            pill_bg = C_RED_SOFT if accent == C_RED else (C_YELLOW_SOFT if accent == C_YELLOW else C_BRAND_10)
            pill_fg = C_RED if accent == C_RED else (C_BLACK if accent == C_YELLOW else C_BRAND)
            add_pill(slide, ax + 0.18, ay + 0.58, 2.10, 0.27, deadline, bg_color=pill_bg, text_color=pill_fg, size_pt=8.8)
            add_textbox(slide, ax + 0.18, ay + 0.94, aw - 0.36, 1.22, desc, size_pt=10.1, color=C_TEXT_MUTED, line_spacing=1.24)

    with anim.wave(540, 320):
        add_rect(slide, 0.60, 6.54, 12.133, 0.36, fill_color=C_BRAND_10, line_color=C_BRAND_20, line_pt=0.8, rounded=True, radius=0.25)
        add_textbox(
            slide, 0.78, 6.54, 11.78, 0.36,
            "Mốc dùng sớm: Check-in, tính cự ly CTP và báo cáo ghé thăm sẵn sàng thí điểm cho 1 đơn vị (~30 người) từ 14/12/2026 nếu có máy chủ IT sớm.",
            size_pt=9.6, bold=True, color=C_BRAND, valign=MSO_ANCHOR.MIDDLE,
        )

    anim.apply()
    add_notes(
        slide,
        "Slide chốt đề xuất hành động ngay sau Demo: chốt ngưỡng sai số km thanh toán CTP, đầu mối làm việc FAST (11/12), "
        "pháp chế rà mẫu đồng ý Luật BVDLCN (D8), máy chủ IT (22/01) và chọn đơn vị thí điểm đợt 1.",
    )


def build_slide_18_demo_closing(prs: Presentation, assets: BrandAssets) -> None:
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide, C_TECH_BG)
    add_slide_transition(slide, "push", "med")
    anim = SlideAnimator(slide)

    # Nền lưới công nghệ + khối phải xanh đậm
    add_tech_grid_bg(slide, 0.0, 0.0, 6.45, 7.5, cols=6, rows=6)
    add_rect(slide, 6.45, 0.0, 6.883, 7.5, fill_color=C_BRAND_DEEP)
    add_tech_grid_bg(slide, 6.45, 0.0, 6.883, 7.5, cols=6, rows=6)
    add_rect(slide, 6.45, 0.0, 0.06, 7.5, fill_color=C_YELLOW)
    add_rect(slide, 0.0, 0.0, 13.333, 0.06, fill_color=C_TECH_MINT)

    # Bên trái: Cảm ơn & Thông tin liên hệ (khớp chỉnh sửa của người dùng, không dùng ký tự cấm)
    assets.add_logo(slide, "white", left_in=0.72, top_in=0.66, width_in=2.40)

    with anim.wave(80, 360):
        add_textbox(slide, 0.72, 1.88, 5.20, 0.80, "Cảm ơn", size_pt=46.0, bold=True, color=C_WHITE)
        add_textbox(
            slide, 0.72, 2.78, 5.30, 0.96,
            "Mục tiêu cao nhất của Phòng ĐMST&CĐS: mang tới một ứng dụng ổn định, dễ dùng và luôn hỗ trợ chủ động, kịp thời cho toàn thể CBNV Vinaseed.",
            size_pt=12.6, color=C_BRAND_10, line_spacing=1.32,
        )

    with anim.wave(220, 360):
        # Thẻ thông tin liên hệ (cập nhật đúng dòng Thiết kế & Phát triển của bạn)
        add_rect(slide, 0.72, 3.96, 5.30, 2.26, fill_color=C_TECH_PANEL, line_color=C_BRAND_90, line_pt=1.0, rounded=True, radius=0.08)
        contacts = [
            ("Đơn vị: ", "Phòng ĐMST&CĐS - Vinaseed"),
            ("Email: ", "dmst-cds@vinaseed.com.vn"),
            ("Điện thoại: ", "0982.109.295"),
            ("Thiết kế & Phát triển: ", "Nguyễn Hoàng Bách\n0985.969.566 - bachnh@vinaseed.com.vn"),
        ]
        tb_c = add_textbox(slide, 0.94, 4.12, 4.86, 1.98)
        add_rich_paragraphs(tb_c.text_frame, contacts, title_pt=10.5, body_pt=10.4, title_color=C_YELLOW, body_color=C_WHITE, space_after_pt=7.0, line_spacing=1.22)
        tb_c.text_frame.paragraphs[-1].space_after = Pt(7.0)
        p_copy = tb_c.text_frame.add_paragraph()
        add_copyright_runs(p_copy, 9.8, C_BRAND_20)

    assets.add_symbol(slide, "white", left_in=0.72, top_in=6.48, width_in=0.48)
    add_textbox(slide, 1.34, 6.56, 4.60, 0.34, "SeedGW  -  Quản lý thị trường Vinaseed", size_pt=10.8, bold=True, color=C_TECH_MINT)

    # Bên phải: Kịch bản Demo trực tiếp cập nhật chuẩn 25/11
    with anim.wave(160, 340):
        add_pill(slide, 6.92, 0.68, 3.35, 0.34, "CHUYỂN SANG DEMO TRỰC TIẾP", bg_color=C_YELLOW, text_color=C_BLACK, size_pt=9.8)
        add_textbox(slide, 6.92, 1.14, 5.85, 0.44, "6 điểm chạm chạy thử trực tiếp hôm nay", size_pt=18.0, bold=True, color=C_WHITE)

    demo_steps = [
        ("01", "Hub, Phân quyền & Tìm nhanh Ctrl+K", "/hub  -  2 bộ phận, 5 vai trò, việc cần làm thật, Ctrl+K & Thông báo"),
        ("02", "Đại lý 7 vùng/34 tỉnh & Khách hàng S1", "/quan-tri/dai-ly, /quan-tri/vung-tinh và /kinh-doanh/khach-hang"),
        ("03", "App tinh gọn 3 tab & Offline thực địa", "Hôm nay, Tuyến hôm nay, Đại lý gần tôi, chụp offline, tick Đây là ĐL mới"),
        ("04", "Web nhận ngay, Bản đồ & Duyệt ĐL 1 bước", "/kinh-doanh/check-in?tab=ban-do, xuất Excel CTP, /kinh-doanh/can-duyet"),
        ("05", "Dashboard Từ ngày - Đến ngày & Tổng quan", "/kinh-doanh/dashboard, /kinh-doanh/bao-cao và /tong-quan"),
        ("06", "Hỗ trợ chủ động, Đồng ý SHA-256 & Lỗi F9", "Nút nổi Hỗ trợ, /quan-tri/ho-tro, /dong-y-cua-toi và /quan-tri/loi-he-thong"),
    ]
    for i, (num, dhead, dsub) in enumerate(demo_steps):
        dy = 1.80 + i * 0.85
        with anim.wave(240 + i * 75, 320):
            add_rect(slide, 6.92, dy, 5.85, 0.74, fill_color=C_TECH_BG, line_color=C_BRAND_90, line_pt=0.9, rounded=True, radius=0.10)
            add_circle_badge(slide, 7.10, dy + 0.17, 0.40, num, bg_color=C_YELLOW, text_color=C_BLACK, size_pt=10.5)
            add_textbox(slide, 7.64, dy + 0.10, 4.98, 0.26, dhead, size_pt=11.2, bold=True, color=C_WHITE)
            add_textbox(slide, 7.64, dy + 0.38, 4.98, 0.28, dsub, size_pt=9.2, color=C_BRAND_20)

    anim.apply()
    add_notes(
        slide,
        "Chuyển ngay sang trình duyệt https://localhost đã đăng nhập sẵn các tab demo và điện thoại đã mở app 0.2.0 (3 tab M12). "
        "Kiểm tra trước 30 phút: tunnel /api/health trả ok, pin điện thoại trên 80%, có video dự phòng mất mạng.",
    )


# ---------------------------------------------------------------------------
# Kiểm tra ký tự bị cấm trong font UTM Neo Sans Intel trên toàn bộ bài trình bày
# ---------------------------------------------------------------------------

def validate_presentation_glyphs(prs: Presentation) -> None:
    violations: list[str] = []

    def check_text(where: str, text: str) -> None:
        if not text:
            return
        match = FORBIDDEN_GLYPHS_RE.search(text)
        if match:
            ch = match.group(0)
            code = f"U+{ord(ch):04X}"
            violations.append(f"{where}: ky tu {code} ({repr(ch)}) trong '{text[:60]}'")

    for s_idx, slide in enumerate(prs.slides, start=1):
        for sh_idx, shape in enumerate(slide.shapes, start=1):
            if shape.has_text_frame:
                for p in shape.text_frame.paragraphs:
                    check_text(f"Slide {s_idx} Shape {sh_idx}", p.text)
            if shape.has_table:
                for r_idx, row in enumerate(shape.table.rows):
                    for c_idx, cell in enumerate(row.cells):
                        check_text(f"Slide {s_idx} Table[{r_idx},{c_idx}]", cell.text)
        if slide.has_notes_slide:
            check_text(f"Slide {s_idx} Notes", slide.notes_slide.notes_text_frame.text)

    if violations:
        raise ValueError(
            "Phat hien ky tu khong co trong font UTM Neo Sans Intel (BRAND.md muc 2):\n  "
            + "\n  ".join(violations)
        )


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parents[1]
    out_path = script_dir / "SeedGW_Gioi_thieu_Demo_27-11.pptx"

    print("Dang tai va render logo chuan Vinaseed tu SVG...")
    assets = BrandAssets(repo_root)

    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    builders = [
        build_slide_01_cover,
        build_slide_02_problem,
        build_slide_03_overview,
        build_slide_04_value_comparison,
        build_slide_05_what_is_built,
        build_slide_06_roles_matrix,
        build_slide_07_e2e_flow,
        build_slide_08_mobile_app,
        build_slide_09_osrm_proof,
        build_slide_10_trust_security,
        build_slide_11_web_operations,
        build_slide_12_data_hygiene,
        build_slide_13_dashboard_executive,
        build_slide_14_architecture_scale,
        build_slide_15_gaps_improvements,
        build_slide_16_roadmap,
        build_slide_17_asks,
        build_slide_18_demo_closing,
    ]
    assert len(builders) == TOTAL_SLIDES

    for idx, fn in enumerate(builders, start=1):
        print(f"  Dang tao Slide {idx:02d}/{TOTAL_SLIDES:02d}...")
        fn(prs, assets)

    print("Dang kiem tra ky tu font UTM Neo Sans Intel...")
    validate_presentation_glyphs(prs)

    prs.save(str(out_path))
    print(f"Hoan tat! Da xuat bo {TOTAL_SLIDES} slide tai:\n  {out_path}")


if __name__ == "__main__":
    main()
