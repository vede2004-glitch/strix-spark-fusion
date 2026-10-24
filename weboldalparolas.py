import json
import re
import os
import time
import calendar
import hashlib
import requests
import feedparser
import torch
import numpy as np
from datetime import datetime
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor
from sentence_transformers import SentenceTransformer

# ==============================================================================
# 1. KONFIGURÁCIÓ
# ==============================================================================
RSS_FEEDS = {
    "Maszol": "https://maszol.ro/rss",
    "Maszol Sport": "https://maszol.ro/sport/rss",
    "Maszol Gazdaság": "https://maszol.ro/gazdasag/rss",
    "Maszol Életmód": "https://maszol.ro/eletmod/rss",

    "Transtelex": "https://transtelex.ro/rss",
    "Átlátszó Erdély": "https://atlatszo.ro/feed/",
    "Udvarhelyi Hírportál (UH.ro)": "https://www.uh.ro/feed/",
    "Kolozsvári Rádió (HU)": "https://www.kolozsvariradio.ro/feed/",
    "Vásárhely.ma": "https://www.vasarhely.ma/feed/",
    "Marosvásárhelyi Rádió (HU)": "https://www.marosvasarhelyiradio.ro/feed/",
    "Mediatica.ro": "https://www.mediatica.ro/feed/",

    "Szatmári sporthírek": "https://szmsport.ro/feed/",
    "Manna": "https://manna.ro/feed/",
    "RomKat": "https://romkat.ro/feed/",
    "Hargita Népe": "https://hargitanepe.ro/rss",

    # Közvetlen Agerpres RSS URL
    "Agerpres (HU)": "https://www.agerpres.ro/magyar/rss",

    "GSP - Gazeta Sporturilor": "https://www.gsp.ro/rss.xml",

    "Economedia": "https://economedia.ro/feed",
    "Ziarul Financiar": "https://www.zf.ro/rss",

    "Cancan.ro": "https://www.cancan.ro/feed",

    "PresaSM (Szatmár)": "https://www.presasm.ro/feed/",

    "Go4IT": "https://www.go4it.ro/feed/",
    "Zonait.ro": "https://zonait.ro/feed/",

    "Digi24": "https://www.digi24.ro/rss",
    "G4Media": "https://www.g4media.ro/feed",
    "HotNews.ro": "https://www.hotnews.ro/rss",
    "Adevărul": "https://adevarul.ro/rss/",
    "Mediafax": "https://www.mediafax.ro/rss/",
    "ProTV Stiri": "https://stirileprotv.ro/rss",
    "Ebihoreanul (Nagyvárad/Bihar)": "https://www.ebihoreanul.ro/rss"
}

MEMORY_FILE = "erdelyi_hirek_memoria.json"
GROUPED_FILE = "erdelyi_hirek_csoportositott.json"
ARCHIVE_FILE = "erdelyi_hirek_archivum.json"
OUTPUT_FILE = "src/data/news.json"

SIMILARITY_THRESHOLD_CROSS_SOURCE = 0.72
SIMILARITY_THRESHOLD_SAME_SOURCE = 0.80

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

CATEGORIES = {
    "Sport": ["foci", "labdarúgás", "mérkőzés", "bajnokság", "edző", "győzelem", "vereség", "liga", "kupa", "meccs", "gól", "kézilabda", "kosárlabda", "jégkorong", "hoki", "fotbal", "meci", "campionat"],
    "Politika": ["kormány", "parlament", "választás", "párt", "politika", "tanács", "polgármester", "miniszter", "szenátus", "döntés", "törvény", "rmdsz", "psd", "pnl", "usr", "aur", "guvern", "alegeri", "primar"],
    "Gazdaság": ["pénz", "euró", "lej", "infláció", "befektetés", "gazdaság", "cégek", "üzlet", "piac", "drágulás", "árak", "bank", "fizetés", "bér", "bani", "inflatie", "investitii", "economie"],
    "Kultúra": ["színház", "múzeum", "koncert", "kiállítás", "könyv", "irodalom", "zene", "művészet", "fesztivál", "egyház", "teatru", "muzeu", "carte", "muzica", "biserica"],
    "Erdély": ["erdély", "székelyföld", "kolozsvár", "marosvásárhely", "csíkszereda", "sepsiszentgyörgy", "székelyudvarhely", "nagyvárad", "szatmárnémeti", "brassó", "hargita", "kovászna", "maros"],
    "Bulvár": ["sztár", "celeb", "szerelem", "szakítás", "házasság", "botrány", "vedeta", "scandal", "divort", "cancan", "showbiz", "horoszkóp"]
}

_MODEL = None

def get_model():
    global _MODEL
    if _MODEL is None:
        print("🧠 SentenceTransformer AI modell betöltése...")
        _MODEL = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        _MODEL.to(torch.float32)
    return _MODEL

# ==============================================================================
# 2. SEGÉDFUNKCIÓK ÉS GYORS KATEGÓRIA OSZTÁLYOZÓ
# ==============================================================================
def parse_published_time(entry) -> int:
    pub_parsed = entry.get('published_parsed') or entry.get('updated_parsed')
    if pub_parsed:
        try:
            return int(calendar.timegm(pub_parsed))
        except Exception:
            pass

    raw_date = entry.get('published') or entry.get('updated') or entry.get('pubDate')
    if raw_date:
        try:
            dt = parsedate_to_datetime(raw_date)
            return int(dt.timestamp())
        except Exception:
            pass

    link = entry.get('link', '')
    url_date_match = re.search(r'(\d{4})[-/](\d{2})[-/](\d{2})', link) or re.search(r'(\d{2})[-/](\d{2})[-/](\d{4})', link)
    if url_date_match:
        try:
            parts = url_date_match.groups()
            if len(parts[0]) == 4:
                dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            else:
                dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            return int(dt.timestamp())
        except Exception:
            pass

    return 0

def load_json_file(filename):
    if os.path.exists(filename):
        try:
            with open(filename, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_json_file(filename, data):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def clean_text(text):
    if not text:
        return ""
    text = BeautifulSoup(text, 'html.parser').text.strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def classify_article(title, summary, source_name):
    text = f"{title} {summary}".lower()

    crime_education_keywords = [
        "rendőrség", "bántalmazás", "letartóztatás", "bíróság", "miniszter", 
        "iskola", "profesor", "politie", "dosar penal", "reţinut", "agresat", "tanár"
    ]
    if any(kw in text for kw in crime_education_keywords):
        if any(w in text for w in ["erdély", "timișoara", "temesvár", "kolozsvár", "marosvásárhely", "székelyföld"]):
            return "Erdély"
        return "Általános"

    if source_name in ["Szatmári sporthírek", "Székely Sport", "Maszol Sport", "GSP - Gazeta Sporturilor"]:
        return "Sport"
    if source_name in ["Maszol Gazdaság", "Economedia", "Ziarul Financiar"]:
        return "Gazdaság"
    if source_name in ["Click.ro", "Cancan.ro", "Maszol Életmód"]:
        return "Bulvár"
    if source_name in ["Udvarhelyi Hírportál (UH.ro)", "Hargita Népe", "PresaSM (Szatmár)", "Szatmári Friss Újság", "Vásárhely.ma", "Átlátszó Erdély", "Ebihoreanul (Nagyvárad/Bihar)"]:
        return "Erdély"

    for category, keywords in CATEGORIES.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text):
                return category

    return "Általános"

def extract_cover_image(entry, article_url, session):
    if 'media_content' in entry and entry.media_content:
        for media in entry.media_content:
            if 'url' in media and media['url']:
                return media['url']
    if 'links' in entry:
        for link in entry.links:
            if link.get('type', '').startswith('image/') and 'href' in link:
                return link['href']
    raw_html = entry.get('summary', '') or entry.get('description', '')
    if raw_html:
        soup = BeautifulSoup(raw_html, 'html.parser')
        img = soup.find('img')
        if img and img.get('src'):
            return img['src']

    return ""

def get_embedding(title, summary):
    clean_title = clean_text(title)
    clean_sum = clean_text(summary)[:250]
    text_to_embed = f"{clean_title}. {clean_title}. {clean_sum}"
    if not text_to_embed.strip():
        return []
    model_inst = get_model()
    embedding = model_inst.encode(text_to_embed, convert_to_numpy=True)
    return np.round(embedding, 4).tolist()

def cosine_similarity(v1, v2):
    if not v1 or not v2:
        return 0.0
    a, b = np.array(v1), np.array(v2)
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def extract_article_data(entry, source_name, session, cutoff_24h):
    title = clean_text(entry.get('title', ''))
    link = entry.get('link', '').strip()

    pub_timestamp = parse_published_time(entry)
    current_now = int(time.time())

    if pub_timestamp > current_now:
        pub_timestamp = current_now

    if pub_timestamp == 0 or pub_timestamp < cutoff_24h:
        return None

    raw_summary = entry.get('summary', '') or entry.get('description', '')
    clean_summary = clean_text(raw_summary)
    image_url = extract_cover_image(entry, link, session)
    category = classify_article(title, clean_summary, source_name)

    return {
        "source": source_name,
        "title": title,
        "link": link,
        "summary": clean_summary,
        "image": image_url,
        "published_at": pub_timestamp,
        "category": category
    }

def fetch_single_feed(item_and_cutoff):
    (source_name, feed_url), cutoff_24h = item_and_cutoff
    extracted = []
    session = requests.Session()
    session.headers.update(HEADERS)
    try:
        response = session.get(feed_url, timeout=12, allow_redirects=True)
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        for entry in feed.entries:
            art = extract_article_data(entry, source_name, session, cutoff_24h)
            if art and art["title"]:
                extracted.append(art)
    except Exception as e:
        print(f"⚠️ Hiba a(z) {source_name} feed beolvasásakor: {e}")
    return extracted

# ==============================================================================
# 3. CSOPORTOSÍTÁS, ARCHÍVUM MENTÉS ÉS NEWS.JSON BŐVÍTÉS
# ==============================================================================
def run_pipeline():
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n[{now_str}] 🔄 Hírcsatornák frissítése indult ({len(RSS_FEEDS)} forrás)...")

    cutoff_24h = int(time.time()) - (24 * 3600)
    memory = load_json_file(MEMORY_FILE)
    archive = load_json_file(ARCHIVE_FILE)

    fetched_articles = []
    feed_items = [((src, url), cutoff_24h) for src, url in RSS_FEEDS.items()]
    
    with ThreadPoolExecutor(max_workers=min(len(RSS_FEEDS), 15)) as executor:
        results = executor.map(fetch_single_feed, feed_items)

    for article_list in results:
        fetched_articles.extend(article_list)

    for art in fetched_articles:
        existing_item = next((m for m in memory if m["link"] == art["link"]), None)
        if existing_item:
            if art["published_at"] > existing_item.get("fetched_at", 0):
                existing_item["title"] = art["title"]
                existing_item["summary"] = art["summary"]
                existing_item["fetched_at"] = art["published_at"]
                if art["image"]:
                    existing_item["image"] = art["image"]
            continue

        art_embedding = get_embedding(art['title'], art['summary'])
        if not art_embedding:
            continue

        best_match_group_id = None
        highest_similarity = -1.0
        best_match_source = ""

        for m_item in memory:
            if "embedding" not in m_item or not m_item["embedding"]:
                m_item["embedding"] = get_embedding(m_item['title'], m_item.get('summary', ''))

            sim = cosine_similarity(art_embedding, m_item["embedding"])
            if sim > highest_similarity:
                highest_similarity = sim
                best_match_group_id = m_item["group_id"]
                best_match_source = m_item["source"]

        required_threshold = SIMILARITY_THRESHOLD_SAME_SOURCE if art["source"] == best_match_source else SIMILARITY_THRESHOLD_CROSS_SOURCE

        if highest_similarity >= required_threshold and best_match_group_id:
            group_id = best_match_group_id
        else:
            link_hash = hashlib.md5(art["link"].encode("utf-8")).hexdigest()[:10]
            group_id = f"group_{link_hash}"

        memory.append({
            "group_id": group_id,
            "source": art["source"],
            "title": art["title"],
            "link": art["link"],
            "image": art["image"],
            "summary": art["summary"],
            "category": art["category"],
            "embedding": art_embedding,
            "fetched_at": art["published_at"]
        })

    # ==============================================================================
    # ARCHIVÁLÁS ÉS MEMÓRIA FRISSÍTÉS (TELJES ARCHÍVUM FELHALMOZÁS)
    # ==============================================================================
    fresh_memory = []
    archive_updated = False
    existing_archive_links = {a["link"] for a in archive}

    for item in memory:
        if item.get("fetched_at", 0) >= cutoff_24h:
            fresh_memory.append(item)
        else:
            if item["link"] not in existing_archive_links:
                clean_arch_item = {k: v for k, v in item.items() if k != "embedding"}
                archive.append(clean_arch_item)
                existing_archive_links.add(item["link"])
                archive_updated = True

    save_json_file(MEMORY_FILE, fresh_memory)
    if archive_updated:
        save_json_file(ARCHIVE_FILE, archive)
        print(f"📦 Archívum frissítve! Összesen {len(archive)} cikk az {ARCHIVE_FILE} fájlban.")

    # Csoportosított memória kiírása
    grouped_dictionary = {}
    for item in fresh_memory:
        g_id = item["group_id"]
        clean_item = {
            "source": item["source"],
            "title": item["title"],
            "link": item["link"],
            "image": item["image"],
            "summary": item["summary"],
            "category": item["category"],
            "published_at": item["fetched_at"]
        }
        if g_id not in grouped_dictionary:
            grouped_dictionary[g_id] = {
                "group_id": g_id,
                "category": item["category"],
                "articles_count": 0,
                "articles": []
            }
        grouped_dictionary[g_id]["articles"].append(clean_item)
        grouped_dictionary[g_id]["articles_count"] += 1

    save_json_file(GROUPED_FILE, list(grouped_dictionary.values()))

    # ==============================================================================
    # BŐVÍTŐ NEWS.JSON FRISSÍTÉS (NEM TÖRÖL, MEGTARTJA AZ AI SZINTETIZÁLT CIKKEKET)
    # ==============================================================================
    os.makedirs("src/data", exist_ok=True)
    existing_news = load_json_file(OUTPUT_FILE)
    
    news_map = {item["group_id"]: item for item in existing_news if isinstance(item, dict) and "group_id" in item}

    for item in fresh_memory:
        g_id = item.get("group_id")
        pub_time = int(item.get("fetched_at", 0))

        # A) HA MÁR BENT VAN A NEWS.JSON-BAN (pl. már AI szintetizált):
        if g_id in news_map:
            existing_sources = {s.get("link") for s in news_map[g_id].get("sources", [])}
            new_source_link = item.get("link")
            
            if new_source_link and new_source_link not in existing_sources:
                news_map[g_id].setdefault("sources", []).append({
                    "source": item.get("source"),
                    "title": item.get("title"),
                    "link": item.get("link")
                })
            
            # 🎯 PONTOS FORRÁSSZÁM FRISSÍTÉSE
            news_map[g_id]["sources_count"] = len(news_map[g_id]["sources"])
        
        # B) HA ÚJ HÍRCSOPORT, HOZZÁADJUK NYERSKÉNT:
        else:
            sources_list = [{
                "source": item.get("source"),
                "title": item.get("title"),
                "link": item.get("link")
            }]
            news_map[g_id] = {
                "group_id": g_id,
                "category": item.get("category", "Általános"),
                "image": item.get("image", ""),
                "is_synthesized": False,
                "sources_count": len(sources_list), # 🎯 PONTOS FORRÁSSZÁM ÚJ KÁRTYÁNÁL IS
                "sources": sources_list,
                "published_at": pub_time,
                "title_hu": item.get("title", ""),
                "lead_hu": item.get("summary", "")[:200] + "..." if item.get("summary") else "",
                "content_hu": item.get("summary", ""),
                "title_ro": item.get("title", ""),
                "lead_ro": item.get("summary", "")[:200] + "..." if item.get("summary") else "",
                "content_ro": item.get("summary", "")
            }

    # 24 órán belüli érvényes cikkek megtartása és rendezése
    updated_list = list(news_map.values())
    valid_news_list = [item for item in updated_list if item.get("published_at", 0) >= cutoff_24h]

    # Biztonsági ellenőrzés a mentés előtt: minden cikknél kényszerítjük a legfrissebb sources_count értéket
    for item in valid_news_list:
        if "sources" in item and isinstance(item["sources"], list):
            item["sources_count"] = len(item["sources"])

    valid_news_list.sort(key=lambda x: x.get("published_at", 0), reverse=True)

    # Forrás szerinti kiegyensúlyozás (ha szükséges)
    balanced_list = []
    skipped_items = []

    for item in valid_news_list:
        item_source = item.get("sources", [{}])[0].get("source")
        if (
            len(balanced_list) >= 2 
            and balanced_list[-1].get("sources", [{}])[0].get("source") == item_source
            and balanced_list[-2].get("sources", [{}])[0].get("source") == item_source
        ):
            skipped_items.append(item)
        else:
            balanced_list.append(item)

    final_list = balanced_list + skipped_items

    save_json_file(OUTPUT_FILE, final_list)
    print(f"⚡ 24 órás hírfrissítés kész! Bővítve és megőrizve {len(final_list)} cikk a {OUTPUT_FILE}-ban.")

if __name__ == "__main__":
    run_pipeline()
