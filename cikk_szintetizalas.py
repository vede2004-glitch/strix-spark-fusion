import json
import os
import time
import requests
import hashlib
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI

# ==============================================================================
# 1. KONFIGURÁCIÓ
# ==============================================================================
MEMORY_FILE = "erdelyi_hirek_memoria.json"
OUTPUT_FILE = "src/data/news.json"

os.makedirs("src/data", exist_ok=True)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

# ✅ gpt-6-luna modell használata
MODEL_NAME = "gpt-6-luna"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ==============================================================================
# 2. SEGÉDFUNKCIÓK ÉS NÉVSORREND-KORREKCIÓ
# ==============================================================================
def fix_hungarian_names(text: str) -> str:
    """
    Kijavítja a gyakori román/nemzetközi nevek sorrendjét a helyes magyar névsorrendre (Vezetéknév + Keresztnév).
    """
    if not text:
        return text

    name_replacements = {
        "Ilie Bolojan": "Bolojan Ilie",
        "Luca Niculescu": "Niculescu Luca",
        "George Simion": "Simion George",
        "Klaus Iohannis": "Iohannis Klaus",
        "Marcel Ciolacu": "Ciolacu Marcel",
        "Peter Magyar": "Magyar Péter",
        "Péter Magyar": "Magyar Péter",
        "Nicolae Ciucă": "Ciucă Nicolae",
        "Mircea Geoană": "Geoană Mircea",
        "Elena Lasconi": "Lasconi Elena",
        "Diana Șoșoacă": "Șoșoacă Diana",
        "Kelemen Hunor": "Kelemen Hunor",  # Már helyes
    }
    
    for wrong_name, correct_name in name_replacements.items():
        text = text.replace(wrong_name, correct_name)
        
    return text

def calculate_fingerprint(articles_or_sources: list) -> str:
    """
    Kiszámítja a cikkek vagy források linkjei alapján a csoport egyedi ujjlenyomatát (hash).
    """
    links = []
    for item in articles_or_sources:
        link = item.get("link", "")
        if link:
            links.append(link)
    sorted_links = sorted(list(set(links)))
    combined = "|".join(sorted_links)
    return hashlib.md5(combined.encode("utf-8")).hexdigest()

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

    # PROMPT: MÁR MEGLÉVŐ CIKK BŐVÍTÉSE
    if existing_synthesized_article and existing_synthesized_article.get("is_synthesized") and not existing_synthesized_article.get("rejected"):
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

SZIGORÚ NÉVHASZNÁLATI SZABÁLY (MAGYAR NYELVEN):
- Minden magyar és romániai személynevet A HAGYOMÁNYOS MAGYAR NÉVSORRENDBEN (Vezetéknév + Keresztnév) írj ki!
- Például: "Bolojan Ilie" (és NE "Ilie Bolojan"), "Niculescu Luca" (és NE "Luca Niculescu"), "Simion George" (és NE "George Simion").

SZIGORÚ KIEMELÉSI ÉS FORMÁTUMSZABÁLYOK (MIND KÉT NYELVEN):
- A "content_hu" és "content_ro" mezőben KIZÁRÓLAG gondolatjelekkel (•) kezdődő, különálló pontokat írj!
- MINDEN EGYES PONT LEGELEJÉN A KULCSÁLLÍTÁST / DÁTUMOT / FŐSZEREPLŐT KÖTELEZŐ FÉLKÖVÉR MARKDOWN-NAL (dupla csillaggal: **szöveg**) KIEMELNED!

KIZÁRÓLAG az alábbi JSON szerkezetben válaszolj:
{{
  "skip": false,
  "title_hu": "Frissített magyar cím",
  "lead_hu": "Frissített 2-3 mondatos magyar lead",
  "content_hu": "• **Dátum vagy Főállítás** első fontos magyar pont...\\n\\n• **Kulcsszó vagy Szereplő** második magyar pont...",
  "title_ro": "Titlu actualizat în română",
  "lead_ro": "Lead de 2-3 propoziții în română",
  "content_ro": "• **Data sau Afirmația Cheie** primul punct în română...\\n\\n• **Cuvânt cheie** al doilea punct...",
  "used_sources_indices": [1, 2]
}}
"""
        return prompt, cover_image, sources_used

    # PROMPT: ÚJ CIKK GENERÁLÁSA
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

SZIGORÚ NÉVHASZNÁLATI SZABÁLY (MAGYAR NYELVEN):
- Minden magyar és romániai személynevet A HAGYOMÁNYOS MAGYAR NÉVSORRENDBEN (Vezetéknév + Keresztnév) írj ki!
- Például: "Bolojan Ilie" (és NE "Ilie Bolojan"), "Niculescu Luca" (és NE "Luca Niculescu"), "Simion George" (és NE "George Simion").

SZIGORÚ KIEMELÉSI ÉS FORMÁTUMSZABÁLYOK (MIND KÉT NYELVEN):
- A "content_hu" és "content_ro" mezőkben KIZÁRÓLAG gondolatjelekkel (•) kezdődő, különálló pontokat írj!
- MINDEN EGYES PONT LEGELEJÉN A KULCSÁLLÍTÁST / DÁTUMOT / FŐSZEREPLŐT KÖTELEZŐ FÉLKÖVÉR MARKDOWN-NAL (dupla csillaggal: **szöveg**) KIEMELNED!

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

def process_group_direct(g_id: str, articles: list, existing_synthesized: dict, group_fingerprint: str):
    is_update = bool(existing_synthesized and existing_synthesized.get("is_synthesized") and not existing_synthesized.get("rejected"))
    tag = "🔄 [FORRÁSBŐVÍTÉS]" if is_update else "🆕 [ÚJ TÉMA]"
    
    print(f"{tag} {g_id} feldolgozása ({len(articles)} forrás)...")
    prompt, cover_image, sources_used = prepare_prompt_content(articles, existing_synthesized)
    category = articles[0].get("category", "Általános")

    latest_timestamp = max([int(a.get("published_at", a.get("fetched_at", time.time()))) for a in articles])

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
            print(f"⚠️ Kiszűrve [{g_id}]: Nem tartalmaz új tényt vagy hiányzik a témaegyezés.")
            rejected_entry = {
                "group_id": g_id,
                "fingerprint": group_fingerprint,
                "is_synthesized": False,
                "rejected": True,
                "published_at": latest_timestamp
            }
            return [rejected_entry], False, is_update

        used_indices = parsed_article.get("used_sources_indices", [])
        if used_indices:
            filtered_sources = [sources_used[i - 1] for i in used_indices if 0 < i <= len(sources_used)]
        else:
            filtered_sources = sources_used

        if len(filtered_sources) < 2:
            print(f"⚠️ Kiszűrve [{g_id}]: Az AI csak {len(filtered_sources)} forrást talált érvényesnek/hasznosnak.")
            rejected_entry = {
                "group_id": g_id,
                "fingerprint": group_fingerprint,
                "is_synthesized": False,
                "rejected": True,
                "published_at": latest_timestamp
            }
            return [rejected_entry], False, is_update

        synthesized_entry = {
            "group_id": g_id,
            "fingerprint": group_fingerprint,
            "category": category,
            "image": cover_image,
            "is_synthesized": True,
            "rejected": False,
            "sources_count": len(filtered_sources),
            "sources": filtered_sources,
            "published_at": latest_timestamp,
            "title_hu": fix_hungarian_names(parsed_article.get("title_hu", "")),
            "lead_hu": fix_hungarian_names(parsed_article.get("lead_hu", "")),
            "content_hu": fix_hungarian_names(parsed_article.get("content_hu", "")),
            "title_ro": parsed_article.get("title_ro", ""),
            "lead_ro": parsed_article.get("lead_ro", ""),
            "content_ro": parsed_article.get("content_ro", "")
        }
        return [synthesized_entry], True, is_update

    except Exception as e:
        print(f"⚠️ Hiba a(z) {g_id} feldolgozásakor: {e}")
        return [], False, is_update

# ==============================================================================
# 3. VALÓS IDEJŰ PÁRHUZAMOS FOLYAMAT (12 ÓRÁS AI SZINTÉZIS + 24 ÓRÁS MEGŐRZÉS)
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

    multi_groups = []
    single_results = []
    
    CURRENT_TIME = int(time.time())
    
    # ⏱️ IDŐABLAK MÉRÉSEK:
    AI_PROCESS_CUTOFF = CURRENT_TIME - (12 * 3600)  # AI szintézis: Csak az elmúlt 12 óra friss hírei (GYORS!)
    RETENTION_CUTOFF = CURRENT_TIME - (24 * 3600)   # Kimentés a news.json-ba: 24 órányi hír megőrzése

    stats = {
        "total_groups": len(grouped_data),
        "expired_groups": 0,
        "single_source_groups": 0,
        "skipped_fingerprint": 0,
        "processed_by_ai": 0
    }

    print(f"📊 {stats['total_groups']} témacsoport elemzése indult...")

    for g_id, articles in grouped_data.items():
        latest_timestamp = max([int(a.get("published_at", a.get("fetched_at", 0))) for a in articles])

        # 1. 24 óránál régebbi híreket végleg elvetjük
        if latest_timestamp < RETENTION_CUTOFF:
            stats["expired_groups"] += 1
            continue

        unique_sources = set(art.get("source") for art in articles if art.get("source"))
        if len(unique_sources) < 2:
            stats["single_source_groups"] += 1
            art = max(articles, key=lambda a: int(a.get("published_at", a.get("fetched_at", 0))))
            summ = fix_hungarian_names(art.get("summary", "") or "")
            lead = (summ[:200] + "…") if len(summ) > 200 else summ
            single_results.append({
                "group_id": g_id,
                "category": art.get("category", "Általános"),
                "image": art.get("image"),
                "is_synthesized": False,
                "sources_count": 1,
                "sources": [{"source": art.get("source", ""), "title": art.get("title", ""), "link": art.get("link", "")}],
                "published_at": latest_timestamp,
                "title_hu": fix_hungarian_names(art.get("title", "")), 
                "lead_hu": lead, 
                "content_hu": summ,
                "title_ro": art.get("title", ""), 
                "lead_ro": lead, 
                "content_ro": summ,
            })
            continue

        current_fingerprint = calculate_fingerprint(articles)
        existing_synth = existing_articles.get(g_id)

        if existing_synth:
            existing_fingerprint = existing_synth.get("fingerprint")
            if not existing_fingerprint and "sources" in existing_synth:
                existing_fingerprint = calculate_fingerprint(existing_synth["sources"])

            if existing_fingerprint and current_fingerprint == existing_fingerprint:
                stats["skipped_fingerprint"] += 1
                continue

        # 2. CSAK AZ ELMÚLT 12 ÓRÁBAN ÉRKEZETT HÍREKET KÜLDJÜK AI SZINTÉZISRE:
        if latest_timestamp >= AI_PROCESS_CUTOFF:
            multi_groups.append((g_id, articles, existing_synth, current_fingerprint))

    stats["processed_by_ai"] = len(multi_groups)

    synthesized_results = []
    if multi_groups:
        print(f"🚀 {len(multi_groups)} db friss (12h) többforrásos csoport küldése az AI-nak ({MODEL_NAME})...")
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [
                executor.submit(process_group_direct, g_id, articles, existing, fingerprint)
                for g_id, articles, existing, fingerprint in multi_groups
            ]
            for future in futures:
                entries, is_synth, is_update = future.result()
                if is_synth:
                    synthesized_results.extend(entries)

    all_final_results = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                for item in existing_data:
                    if "group_id" in item:
                        all_final_results[item["group_id"]] = item
        except Exception as e:
            print(f"⚠️ Nem sikerült beolvasni a korábbi {OUTPUT_FILE} fájlt: {e}")

    for item in single_results:
        all_final_results[item["group_id"]] = item
    for item in synthesized_results:
        all_final_results[item["group_id"]] = item

    # 3. MEGŐRZÉS: A KÍRÓDÓ NEWS.JSON-BA 24 ÓRÁNYI HÍR TARTALOM KERÜL!
    fresh_items = [
        item for item in all_final_results.values() 
        if item.get("published_at", 0) >= RETENTION_CUTOFF
    ]

    frontend_news = [
        item for item in fresh_items 
        if not item.get("rejected")
    ]

    final_sorted_list = sorted(
        frontend_news, 
        key=lambda x: x.get("published_at", 0), 
        reverse=True
    )

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_sorted_list, f, ensure_ascii=False, indent=2)

    HISTORY_FILE = "src/data/news_archive.json"
    history = {}
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                for item in json.load(f):
                    if "group_id" in item:
                        history[item["group_id"]] = item
        except Exception as e:
            print(f"⚠️ Nem sikerült beolvasni a {HISTORY_FILE} fájlt: {e}")
    for item in all_final_results.values():
        if not item.get("rejected"):
            history[item["group_id"]] = item
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted(history.values(), key=lambda x: x.get("published_at", 0), reverse=True), f, ensure_ascii=False, indent=2)

    print(f"💾 Összesen {len(final_sorted_list)} friss (24 órás megőrzésű) cikk mentve a {OUTPUT_FILE} fájlba.")

if __name__ == "__main__":
    run_synthesis_direct()
