import json
import os
import time
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI

# ==============================================================================
# 1. KONFIGURÁCIÓ
# ==============================================================================
MEMORY_FILE = "erdelyi_hirek_memoria.json"
OUTPUT_FILE = "src/data/news.json"

# ✅ Automatikusan létrehozza az src/data mappát, ha még nem létezik:
os.makedirs("src/data", exist_ok=True)

# ✅ KÖRNYEZETI VÁLTOZÓBÓL TÖRTÉNŐ BEOLVASÁS:
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

MODEL_NAME = "gpt-6-luna"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ==============================================================================
# 2. SEGÉDFUNKCIÓK
# ==============================================================================
def fetch_full_article_text(url: str) -> str:
    if not url:
        return ""
    try:
        response = requests.get(url, headers=HEADERS, timeout=8)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        
        paragraphs = soup.find_all("p")
        text_blocks = [p.text.strip() for p in paragraphs if len(p.text.strip()) > 35]
        return "\n\n".join(text_blocks)
    except Exception as e:
        print(f"⚠️ Nem sikerült a cikk letöltése ({url}): {e}")
        return ""

def process_single_article(art: dict) -> dict:
    full_text = fetch_full_article_text(art.get("link", ""))
    content_to_use = full_text if len(full_text) > 120 else art.get("summary", "")
    return {
        "source": art.get("source", ""),
        "title": art.get("title", ""),
        "link": art.get("link", ""),
        "image": art.get("image", ""),
        "content": content_to_use
    }

def load_existing_synthesized_articles() -> dict:
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {item["group_id"]: item for item in data if "group_id" in item}
        except Exception as e:
            print(f"⚠️ Nem sikerült beolvasni a meglévő {OUTPUT_FILE} fájlt: {e}")
    return {}

def prepare_prompt_content(articles: list, existing_synthesized_article: dict = None) -> tuple:
    with ThreadPoolExecutor(max_workers=min(len(articles), 5)) as executor:
        scraped_results = list(executor.map(process_single_article, articles))

    sources_used = []
    cover_image = articles[0].get("image", "https://via.placeholder.com/600x400?text=Nincs+Kep")

    for res in scraped_results:
        sources_used.append({
            "source": res["source"],
            "title": res["title"],
            "link": res["link"]
        })

    # =========================================================================
    # 1. PROMPT: MÁR MEGLÉVŐ CIKK BŐVÍTÉSE (MAGYAR ÉS ROMÁN NYELVEN)
    # =========================================================================
    if existing_synthesized_article and existing_synthesized_article.get("is_synthesized"):
        old_title_hu = existing_synthesized_article.get("title_hu", "")
        old_lead_hu = existing_synthesized_article.get("lead_hu", "")
        old_content_hu = existing_synthesized_article.get("content_hu", "")

        new_sources_text = ""
        for idx, res in enumerate(scraped_results, 1):
            new_sources_text += f"\n--- ÚJ FORRÁS ({res['source']}): {res['title']} ---\n"
            new_sources_text += f"{res['content']}\n"

        prompt = f"""
Te a Hírelemző szerkesztője vagy. Korábban már írtál egy pontokba szedett összefoglalót egy témában, de most ÚJ forrás(ok) érkeztek hozzá.

MÁR MEGLÉVŐ ÖSSZEFOGLALÓ (HU):
Cím: {old_title_hu}
Lead: {old_lead_hu}
Tartalom:
{old_content_hu}

ÚJONNAN ÉRKEZETT FORRÁSOK TARTALMA:
{new_sources_text}

FELADAT:
1. Vizsgáld meg az új forrásokat!
2. HA tartalmaz új tényt, adatsort vagy dátumot, EGÉSZÍTSD KI a meglévő pontokból álló listát újabb gondolatjelekkel (•)!
3. HA nincs benne új információ, állítsd a "skip" mezőt true-ra!
4. Írd meg a frissített összefoglalót MAGYAR és ROMÁN nyelven is!

FORMÁTUM ÉS STÍLUS (MIND KÉT NYELVEN):
- A "content_hu" és "content_ro" mezőben KIZÁRÓLAG gondolatjelekkel (•) kezdődő, különálló pontokat írj!
- Minden pontban a legfontosabb kulcsszavakat, dátumokat, helyszíneket és számokat EMELD KI FÉLKÖVÉRREL (pl. **Szeptember 30-án**, **30 septembrie**)!

KIZÁRÓLAG az alábbi JSON szerkezetben válaszolj:
{{
  "skip": false,
  "title_hu": "Frissített magyar cím",
  "lead_hu": "Frissített 2-3 mondatos magyar lead",
  "content_hu": "• **Dátum** első fontos magyar pont...\\n\\n• **Kulcsszó** második magyar pont...",
  "title_ro": "Titlu actualizat în română",
  "lead_ro": "Lead de 2-3 propoziții în română",
  "content_ro": "• **Data** primul punct în română...\\n\\n• **Cuvânt cheie** al doilea punct...",
  "used_sources_indices": [1]
}}
"""
        return prompt, cover_image, sources_used

    # =========================================================================
    # 2. PROMPT: ÚJ CIKK GENERÁLÁSA (MAGYAR ÉS ROMÁN NYELVEN)
    # =========================================================================
    combined_sources = ""
    for idx, res in enumerate(scraped_results, 1):
        combined_sources += f"\n--- {idx}. FORRÁS: {res['source']} | Cím: {res['title']} ---\n"
        combined_sources += f"{res['content']}\n"

    prompt = f"""
Te a Hírelemző portál vezető szerkesztője vagy. Az alábbiakban megadok több hírforrásból származó cikket egy témacsoportból.

FELADAT ÉS SZŰRÉS:
1. Szigorúan vizsgáld meg a megadott források tartalmát!
2. HA BÁRMELYIK FORRÁS NEM UGYANARRÓL AZ ESEMÉNYRŐL SZÓL, AZT TELJESEN HAGYD KI!
3. Ha a szűrés után nem marad legalább 2 összetartozó forrás, állítsd a "skip" mezőt true-ra!
4. Készíts két teljes értékű összefoglalót: egyet MAGYARUL és egyet ROMÁNUL!

MINDENRE KITERJEDŐ FELSOROLÁSOS FORMÁTUM (HÍRELEMZŐ STÍLUS):
- A "content_hu" és "content_ro" mezőkben KIZÁRÓLAG gondolatjelekkel (•) kezdődő, különálló pontokat írj!
- A pontokat rendezd logikus/időrendi sorrendbe.
- **Kiemelések használata:** A pontokon belül a legfontosabb adatokat, dátumokat, helyszíneket és neveket mindig EMELD KI FÉLKÖVÉR MARKDOWN-NAL mindkét nyelven (pl. **Szeptember 30-án** / **30 septembrie**)!

KIZÁRÓLAG az alábbi JSON szerkezetben válaszolj:
{{
  "skip": false,
  "title_hu": "A tényekre fókuszáló magyar cím",
  "lead_hu": "2-3 mondatos magyar összefoglaló lead",
  "content_hu": "• **Szeptember 30-án** Oroszország tavasz óta a legnagyobb...\\n\\n• A **Tripilszka hőerőmű** is találatot kapott...",
  "title_ro": "Titlul în română focalizat pe fapte",
  "lead_ro": "Rezumat de 2-3 propoziții în română",
  "content_ro": "• Pe **30 septembrie** Rusia a lansat cel mai mare...\\n\\n• Centrala termică **Trypilska** a fost de asemenea lovită...",
  "used_sources_indices": [1, 2]
}}

FORRÁSOK:
{combined_sources}
"""
    return prompt, cover_image, sources_used

def process_group_direct(g_id: str, articles: list, existing_synthesized: dict):
    """Közvetlen API hívást végző segédfüggvény egy csoportra."""
    print(f"🌐 Weboldalak feldolgozása a(z) {g_id} csoporthoz ({len(articles)} forrás)...")
    prompt, cover_image, sources_used = prepare_prompt_content(articles, existing_synthesized)
    category = articles[0].get("category", "Általános")

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": "Kizárólag érvényes JSON objektumot adj vissza!"},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content_str = response.choices[0].message.content
        parsed_article = json.loads(content_str)

        if parsed_article.get("skip") is True:
            print(f"⚠️ Kiszűrve [{g_id}]: A cikkek nem érték el a kívánt témaegyezést.")
            fallback_entries = []
            for art in articles:
                title_hu = art.get("title", "")
                lead_hu = art.get("summary", "")[:200] + "..." if art.get("summary") else ""
                content_hu = art.get("summary", "")
                fallback_entries.append({
                    "group_id": g_id,
                    "category": art.get("category", "Általános"),
                    "image": art.get("image"),
                    "is_synthesized": False,
                    "sources": [{"source": art.get("source"), "title": art.get("title"), "link": art.get("link")}],
                    "title_hu": title_hu,
                    "lead_hu": lead_hu,
                    "content_hu": content_hu,
                    "title_ro": title_hu,
                    "lead_ro": lead_hu,
                    "content_ro": content_hu
                })
            return fallback_entries, False

        used_indices = parsed_article.get("used_sources_indices", [])
        if used_indices:
            filtered_sources = [sources_used[i - 1] for i in used_indices if 0 < i <= len(sources_used)]
        else:
            filtered_sources = sources_used

        synthesized_entry = {
            "group_id": g_id,
            "category": category,
            "image": cover_image,
            "is_synthesized": True,
            "sources_count": len(filtered_sources),
            "sources": filtered_sources,
            "title_hu": parsed_article.get("title_hu", ""),
            "lead_hu": parsed_article.get("lead_hu", ""),
            "content_hu": parsed_article.get("content_hu", ""),
            "title_ro": parsed_article.get("title_ro", ""),
            "lead_ro": parsed_article.get("lead_ro", ""),
            "content_ro": parsed_article.get("content_ro", "")
        }
        return [synthesized_entry], True

    except Exception as e:
        print(f"⚠️ Hiba a(z) {g_id} feldolgozásakor: {e}")
        return [], False

# ==============================================================================
# 3. VALÓS IDEJŰ PÁRHUZAMOS FOLYAMAT
# ==============================================================================
def run_synthesis_direct():
    if not os.path.exists(MEMORY_FILE):
        print(f"⚠️ A memóriafájl ({MEMORY_FILE}) nem található!")
        return

    with open(MEMORY_FILE, "r", encoding="utf-8") as f:
        memory = json.load(f)

    existing_articles = load_existing_synthesized_articles()

    grouped_data = {}
    for item in memory:
        g_id = item.get("group_id")
        if g_id:
            grouped_data.setdefault(g_id, []).append(item)

    synthesized_results = []
    single_count = 0
    multi_groups = []

    print(f"📊 {len(grouped_data)} témacsoport elemzése indult...")

    # Szétválasztjuk az 1 forrásos és többforrásos híreket
    for g_id, articles in grouped_data.items():
        if len(articles) > 1:
            multi_groups.append((g_id, articles, existing_articles.get(g_id)))
        else:
            art = articles[0]
            title_hu = art.get("title", "")
            lead_hu = art.get("summary", "")[:200] + "..." if art.get("summary") else ""
            content_hu = art.get("summary", "")

            synthesized_results.append({
                "group_id": g_id,
                "category": art.get("category", "Általános"),
                "image": art.get("image"),
                "is_synthesized": False,
                "sources": [{"source": art.get("source"), "title": art.get("title"), "link": art.get("link")}],
                "title_hu": title_hu,
                "lead_hu": lead_hu,
                "content_hu": content_hu,
                "title_ro": title_hu,
                "lead_ro": lead_hu,
                "content_ro": content_hu
            })
            single_count += 1

    # Párhuzamosan futtatjuk az OpenAI API hívásokat a többforrásos cikkekre
    if multi_groups:
        print(f"🚀 {len(multi_groups)} db többforrásos csoport feldolgozása indult párhuzamosan...")
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(process_group_direct, g_id, articles, existing)
                for g_id, articles, existing in multi_groups
            ]
            for future in futures:
                entries, is_synth = future.result()
                synthesized_results.extend(entries)
                if not is_synth:
                    single_count += len(entries)

    # Mentés a kimeneti JSON fájlba
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(synthesized_results, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"✅ FOLYAMAT KÉSZ!")
    print(f"🤖 AI által összevont / bővített magyar és román hírek: {len(synthesized_results) - single_count} db")
    print(f"📰 Egyedi / Kiszűrt hírek: {single_count} db")
    print(f"💾 Összesen {len(synthesized_results)} cikk elmentve a(z) {OUTPUT_FILE} fájlba.")
    print("=" * 60)

if __name__ == "__main__":
    run_synthesis_direct()
