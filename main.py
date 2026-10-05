import json
import os
import sys

# Importáljuk a két meglévő Python modulodat
import weboldalparolas
import cikk_szintetizalas

def main():
    print("=" * 60)
    print("🚀 STIRIX - AUTOMATIKUS HÍRFELDOLGOZÓ ÉS SZINTETIZÁLÓ FOLYAMAT")
    print("=" * 60)

    # --------------------------------------------------------------------------
    # 1. LÉPÉS: Weboldalak parólása és hírek csoportosítása
    # --------------------------------------------------------------------------
    print("\n📡 1. LÉPÉS: RSS hírcsatornák beolvasása és csoportosítása...")
    try:
        # Lefuttatjuk a weboldalparolas egyetlen pipeline-ját
        weboldalparolas.run_pipeline()
    except Exception as e:
        print(f"❌ Hiba történt a parólás során: {e}")
        sys.exit(1)

    # --------------------------------------------------------------------------
    # 2. LÉPÉS: Memória ellenőrzése (Szükséges-e az AI szintetizálás?)
    # --------------------------------------------------------------------------
    memory_file = weboldalparolas.MEMORY_FILE
    if not os.path.exists(memory_file):
        print("⚠️ A memóriafájl nem található. Leállás.")
        return

    with open(memory_file, "r", encoding="utf-8") as f:
        memory_data = json.load(f)

    # Csoportosítjuk a memóriát group_id alapján
    grouped_data = {}
    for item in memory_data:
        g_id = item.get("group_id")
        if g_id:
            grouped_data.setdefault(g_id, []).append(item)

    total_groups = len(grouped_data)
    # Megszámoljuk azokat a csoportokat, ahol több mint 1 forrás található
    multi_source_groups = [articles for articles in grouped_data.values() if len(articles) > 1]
    multi_source_count = len(multi_source_groups)

    print(f"\n📊 FELDOLGOZÁS EREDMÉNYE:")
    print(f"   • Összes témacsoport: {total_groups} db")
    print(f"   • Többforrásból összevonható hírek (AI igénylők): {multi_source_count} db")

    # --------------------------------------------------------------------------
    # 3. LÉPÉS: FELTÉTELES AI INDÍTÁS
    # --------------------------------------------------------------------------
    if total_groups == 0:
        print("\nℹ️ Nincsenek hírek a rendszerben. Az AI szintetizálás KIHAGYVA.")
        return

    if multi_source_count == 0:
        print("\nℹ️ Csak 1 forrásból származó (egyedi) hírek vannak.")
        print("💡 Nincs szükség OpenAI API hívásra! Közvetlen mentés a JSON fájlba (0 Ft költség)...")
        
        # Létrehozzuk a szintetizált struktúrát AI nélkül az egyedi hírekre
        synthesized_results = []
        for g_id, articles in grouped_data.items():
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
                "content": {
                    "hu": {"title": title_hu, "lead": lead_hu, "content": content_hu}
                }
            })

        output_file = "public/szintetizalt_hirek.json" if os.path.exists("public") else "szintetizalt_hirek.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(synthesized_results, f, ensure_ascii=False, indent=2)

        print(f"✅ Mentve a(z) '{output_file}' fájlba AI használata nélkül!")
        return

    # --------------------------------------------------------------------------
    # 4. LÉPÉS: AI Szintetizálás Batch indítása (Ha van 2+ forrású hír)
    # --------------------------------------------------------------------------
    print(f"\n🤖 2. LÉPÉS: {multi_source_count} db többforrásos hír szintetizálása OpenAI-val...")
    try:
        cikk_szintetizalas.run_synthesis_batch()
    except Exception as e:
        print(f"❌ Hiba történt az AI szintetizálás során: {e}")

    print("\n🎉 A TELJES FOLYAMAT SIKERESEN LEFUTOTT!")

if __name__ == "__main__":
    main()