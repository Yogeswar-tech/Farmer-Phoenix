"""Quick utility script to inspect registered farmers in the Kisan Sethu Backend Users Table."""

import sqlite3
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = ROOT_DIR / "database" / "kisan_sethu.db"

def inspect_users():
    if not DB_PATH.exists():
        print(f"[!] Database file not found at: {DB_PATH}")
        return

    print("=" * 80)
    print(f" Kisan Sethu - Backend Users Database Inspection")
    print(f" File: {DB_PATH}")
    print("=" * 80)

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC;")
        rows = cursor.fetchall()

        if not rows:
            print("[i] The 'users' table is currently empty.")
            return

        print(f"Total Registered Farmers: {len(rows)}\n")
        header = f"{'Phone Number':<16} | {'First Name':<12} | {'Last Name':<12} | {'Crop':<10} | {'Lang':<5} | {'Created At':<20}"
        print(header)
        print("-" * len(header))

        for r in rows:
            phone = str(r["phone_number"] or "")
            fn = str(r["first_name"] or "")
            ln = str(r["last_name"] or "")
            crop = str(r["crop_name"] or "-")
            lang = str(r["preferred_lang"] or "en")
            created = str(r["created_at"] or "")
            print(f"{phone:<16} | {fn:<12} | {ln:<12} | {crop:<10} | {lang:<5} | {created:<20}")

        print("=" * 80)
    except Exception as exc:
        print(f"[!] Error querying users table: {exc}")
    finally:
        conn.close()

if __name__ == "__main__":
    inspect_users()
