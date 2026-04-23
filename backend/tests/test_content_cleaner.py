from pathlib import Path
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import html as ihtml
import re


def clean_html_to_markdown(html_path: str, output_path: str | None = None) -> str:
    """
    将 HTML 文件清洗并转换为 Markdown。
    适合处理公众号文章、富文本网页导出内容等带较多噪声的 HTML。

    Args:
        html_path: 输入 HTML 文件路径
        output_path: 输出 Markdown 文件路径；不传则自动生成同名 .cleaned.md

    Returns:
        生成的 Markdown 文件路径
    """
    input_path = Path(html_path)
    if not input_path.exists():
        raise FileNotFoundError(f"找不到输入文件: {input_path}")

    if output_path is None:
        output_path = str(input_path.with_suffix(".cleaned.md"))

    raw = input_path.read_text(encoding="utf-8", errors="ignore")

    # 1) 反转义：处理常见的字符串化 HTML 残留
    raw = raw.replace(r"\n", "\n")
    raw = raw.replace(r"\/", "/")
    raw = raw.replace(r"\"", "\"")
    raw = ihtml.unescape(raw)

    # 2) 解析 HTML
    soup = BeautifulSoup(raw, "html.parser")

    # 3) 删除明显无意义的标签
    for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
        tag.decompose()

    # 4) 明确的页面交互噪声
    noise_exact = {
        "知道了",
        "取消",
        "允许",
        "微信扫一扫可打开此内容",
        "使用完整服务",
        "预览时标签不可点",
        "继续滑动看下一个",
        "轻触阅读原文",
        "向上滑动看下一个",
        "赞",
        "在看",
        "分享",
        "留言",
        "收藏",
        "听过",
        "分析",
        "×",
    }

    # 5) 删除空图片
    for img in soup.find_all("img"):
        src = (img.get("src") or "").strip()
        if not src:
            img.decompose()

    # 6) 删除 javascript: 链接和明显按钮链接
    for a in soup.find_all("a"):
        href = (a.get("href") or "").strip().lower()
        text = a.get_text(" ", strip=True)
        if href.startswith("javascript:") or text in {"知道了", "取消", "允许"}:
            a.decompose()

    # 7) 删除空块 / 明显噪声块
    for node in soup.find_all(["p", "div", "span"]):
        text = node.get_text(" ", strip=True)

        if not text and not node.find("img"):
            node.decompose()
            continue

        if text in noise_exact:
            node.decompose()
            continue

        if "微信扫一扫可打开此内容" in text or "使用完整服务" in text:
            node.decompose()
            continue

    # 8) HTML -> Markdown
    markdown = md(str(soup), heading_style="ATX")

    # 9) Markdown 行级后处理
    lines = markdown.splitlines()
    cleaned = []

    for line in lines:
        s = line.strip()

        # 处理 literal \n 或空行
        if s in {r"\n", ""}:
            if cleaned and cleaned[-1] == "":
                continue
            cleaned.append("")
            continue

        # 删除空图片
        if re.fullmatch(r"!\[[^\]]*\]\(\s*\)", s):
            continue

        # 删除纯标点噪声
        if re.fullmatch(r"[：，。、“”‘’·\-\s]+", s):
            continue

        # 删除噪声短句
        if s in noise_exact:
            continue

        cleaned.append(line.rstrip())

    markdown = "\n".join(cleaned)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip() + "\n"

    # 10) 写出文件
    out_path = Path(output_path)
    out_path.write_text(markdown, encoding="utf-8")

    return str(out_path)


if __name__ == "__main__":
    # 示例：
    # python clean_html_to_md.py "Pasted code.html"
    import sys

    if len(sys.argv) < 2:
        print("用法: python clean_html_to_md.py <input_html> [output_md]")
        raise SystemExit(1)

    input_html = "your content_html_str"
    output_md = "/path/save_your_md"

    result = clean_html_to_markdown(input_html, output_md)
    print(f"已生成 Markdown 文件: {result}")