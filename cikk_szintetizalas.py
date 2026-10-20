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
    Mivel a linkeket ábécé sorrendbe rendezi, a sorrendváltozás sem okoz hamis frissítést.
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
    """Beolvassa a már korábban elmentett kimeneti híreket a group_id alapján (beleértve az elutasítottakat is)."""
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
    """Közvetlen API hívást végző segédfüggvény egy csoportra."""
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

        # 🛑 HA AZ AI SKIP-ET AD VISSZA:
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

        # 🛑 HA KEVESEBB MINT 2 FORRÁS MARADT UTÁNA:
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
            # 🟢 MAGYAR NÉVSORREND-KORREKCIÓ ALKALMAZÁSA:
            "title_hu": fix_hungarian_names(parsed_article.get("title_hu", "")),
            "lead_hu": fix_hungarian_names(parsed_article.get("lead_hu", "")),
            "content_hu": fix_hungarian_names(parsed_article.get("content_hu", "")),
            "title_ro": parsed_article.get("title_ro", ""),
            "lead
