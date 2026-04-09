import httpx
import json
from openai import AsyncOpenAI
from database import get_ai_config


# === AI Prompts ===

PROMPT_ANCHOR_EXTRACT = """你是一个资深编辑，负责从文章中提炼具有辩证性的洞察。

任务：
1. 提取文章的核心观点（不是摘要，是观点）
2. 给出辩证分析，格式必须包含：
   - 【支持】观点成立的核心论据
   - 【质疑】潜在的反对声音或局限
   - 【延伸】这一观点的深层影响或衍生思考
3. 识别文章涉及的领域/话题标签

格式要求（严格按JSON输出）：
{{
  "title": "洞察标题，20字内",
  "content": "核心内容，200字内",
  "dialectical_analysis": "辩证分析，150字内，格式【支持】...【质疑】...【延伸】...",
  "anchor_type": "breakthrough | controversy | data | opinion",
  "tags": ["标签1", "标签2"],
  "significance": 0.0-1.0之间的小数
}}

原文信息：
标题：{title}
内容：{content}

请严格按JSON格式输出，不要添加任何其他内容："""

PROMPT_DIGEST_SYNTHESIZE = """你是一个资深编辑，负责将多个洞察合成一篇结构化每日简报。

要求：
1. 将锚点按领域/主题分组
2. 每组选取最重要的洞察（主航道选2-3个，探索区选1-2个）
3. 撰写导语，总结今日整体态势（100字内）
4. 保持文字流畅，像编辑好的Newsletter
5. 注意多样性：同一领域不超过60%篇幅
6. zone: "main"给强兴趣内容，"explore"给弱兴趣内容

输出格式（严格按JSON）：
{{
  "overview": "今日导语，100字内",
  "sections": [
    {{
      "domain": "领域名",
      "domain_icon": "emoji图标",
      "insights": [
        {{
          "anchor_id": 数字,
          "title": "标题",
          "content": "内容",
          "dialectical_analysis": "辩证分析",
          "source_article_link": "原文链接",
          "source_name": "来源名称",
          "tags": ["标签"],
          "zone": "main | explore"
        }}
      ]
    }}
  ]
}}

今日锚点：
{anchors_json}

请严格按JSON格式输出，不要添加任何其他内容："""

PROMPT_DOMAIN_CLASSIFY = """将以下标签分类到对应的领域：

标签列表：{tags}

领域选项：AI领域, 金融领域, 科技领域, 生物医药, 教育, 文化, 其他

输出JSON格式：
{{
  "mappings": {{"标签名": "领域"}}
}}"""


async def get_openai_client() -> AsyncOpenAI:
    """Get configured OpenAI-compatible client"""
    config = get_ai_config()
    return AsyncOpenAI(
        api_key=config["api_key"],
        base_url=config["base_url"]
    )


async def summarize_text(title: str, content: str, max_length: int = 150) -> str:
    """Generate AI summary for article content"""
    config = get_ai_config()

    if not config or not config["api_key"]:
        return "AI 配置未完成，请在设置页面配置 API Key"

    # Truncate content if too long
    truncated_content = content[:4000] if len(content) > 4000 else content

    prompt = f"""请用 50-{max_length} 字总结以下文章的核心内容，使用简洁的中文：

标题：{title}

内容：{truncated_content}

请直接输出总结，不要添加任何前缀或解释："""

    try:
        client = await get_openai_client()
        response = await client.chat.completions.create(
            model=config["model"],
            messages=[
                {"role": "system", "content": "你是一个文章总结助手，用简洁的中文总结文章内容。"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        summary = response.choices[0].message.content.strip()
        return summary if summary else "AI 总结生成失败"
    except Exception as e:
        return f"AI 总结生成失败: {str(e)}"


async def extract_anchor(title: str, content: str, article_link: str = "", source_name: str = "") -> dict:
    """Extract anchor point from article using AI"""
    config = get_ai_config()

    if not config or not config["api_key"]:
        return {
            "title": title[:20],
            "content": content[:200],
            "dialectical_analysis": "【支持】AI配置未完成【质疑】无法提取【延伸】请配置API",
            "anchor_type": "opinion",
            "tags": [],
            "significance": 0.5
        }

    # Truncate content
    truncated_content = content[:3000] if len(content) > 3000 else content

    prompt = PROMPT_ANCHOR_EXTRACT.format(title=title, content=truncated_content)

    try:
        client = await get_openai_client()
        response = await client.chat.completions.create(
            model=config["model"],
            messages=[
                {"role": "system", "content": "你是一个资深编辑，负责从文章中提炼具有辩证性的洞察。严格按JSON格式输出。"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.7
        )
        result_text = response.choices[0].message.content.strip()

        # Parse JSON from response
        # Try to extract JSON if it's wrapped in markdown
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        anchor_data = json.loads(result_text.strip())
        anchor_data["source_article_title"] = title
        anchor_data["source_article_link"] = article_link
        anchor_data["source_name"] = source_name

        return anchor_data
    except json.JSONDecodeError as e:
        return {
            "title": title[:20],
            "content": content[:200],
            "dialectical_analysis": f"【支持】内容提取成功【质疑】JSON解析失败【延伸】错误: {str(e)}",
            "anchor_type": "opinion",
            "tags": [],
            "significance": 0.5,
            "source_article_title": title,
            "source_article_link": article_link,
            "source_name": source_name
        }
    except Exception as e:
        return {
            "title": title[:20],
            "content": content[:200],
            "dialectical_analysis": f"【支持】提取失败【质疑】异常发生【延伸】错误: {str(e)}",
            "anchor_type": "opinion",
            "tags": [],
            "significance": 0.5,
            "source_article_title": title,
            "source_article_link": article_link,
            "source_name": source_name
        }


async def synthesize_digest(anchors: list[dict], user_interests: list[dict] = None) -> dict:
    """Synthesize daily digest from anchors using AI"""
    config = get_ai_config()

    if not config or not config["api_key"]:
        return {
            "overview": "AI配置未完成，无法生成简报",
            "sections": []
        }

    if not anchors:
        return {
            "overview": "今日暂无新的锚点信息",
            "sections": []
        }

    # Prepare anchors JSON
    anchors_json = json.dumps(anchors, ensure_ascii=False, indent=2)

    # Prepare user interests
    interests_text = ""
    if user_interests:
        interests_text = "\n".join([f"- {i['tag']}: 权重{i['weight']}" for i in user_interests[:10]])
    else:
        interests_text = "用户暂无明确的兴趣标签偏好"

    prompt = PROMPT_DIGEST_SYNTHESIZE.format(
        anchors_json=anchors_json,
        user_interests=interests_text
    )

    try:
        client = await get_openai_client()
        response = await client.chat.completions.create(
            model=config["model"],
            messages=[
                {"role": "system", "content": "你是一个资深编辑，负责将多个洞察合成一篇结构化每日简报。严格按JSON格式输出。"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500,
            temperature=0.7
        )
        result_text = response.choices[0].message.content.strip()

        # Parse JSON from response
        if "```json" in result_text:
            result_text = result_text.split("```json")[1].split("```")[0]
        elif "```" in result_text:
            result_text = result_text.split("```")[1].split("```")[0]

        digest_data = json.loads(result_text.strip())
        return digest_data
    except json.JSONDecodeError as e:
        return {
            "overview": f"简报合成失败，JSON解析错误: {str(e)[:50]}",
            "sections": []
        }
    except Exception as e:
        return {
            "overview": f"简报合成失败: {str(e)[:50]}",
            "sections": []
        }


async def test_ai_connection() -> tuple[bool, str]:
    """Test AI API connection"""
    try:
        client = await get_openai_client()
        response = await client.chat.completions.create(
            model=get_ai_config()["model"],
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        return True, "连接成功"
    except Exception as e:
        return False, str(e)
