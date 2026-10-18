import urllib.request
import json
import urllib.parse
from datetime import datetime

commodities = [('Tomato', 'Tomato'), ('Onion', 'Onion'), ('Red Chilli', 'Dry Chillies')]
base_url = 'https://mandi-api.onrender.com/v1/prices'

for label, api_comm in commodities:
    url = f"{base_url}?commodity={urllib.parse.quote(api_comm)}"
    req = urllib.request.Request(url, headers={'User-Agent': 'KisanSethu-Auditor/1.0 (contact@kisan-sethu.in)'})
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        records = data.get('data', [])
        print('=' * 60)
        print(f"REPORT FOR: {label} (API query: '{api_comm}')")
        print(f"Success: {data.get('success')}")
        print(f"Total Records Returned: {len(records)}")
        if records:
            first = records[0]
            print(f"Fields in records: {sorted(list(first.keys()))}")
            print("Sample First Record:")
            print(json.dumps(first, indent=2))

            dates = [r.get('arrival_date') for r in records if r.get('arrival_date')]
            unique_dates = sorted(list(set(dates)))
            print(f"Date Range: {unique_dates[0]} to {unique_dates[-1]}")
            print(f"Unique Dates Count: {len(unique_dates)} ({unique_dates})")

            # Check junk rows:
            # 1. Price < 50 or > 500000
            junk_prices = [
                r for r in records
                if float(r.get('modal_price') or 0) < 50 or float(r.get('modal_price') or 0) > 500000
            ]
            print(f"Junk Price Count (< 50 or > 500,000): {len(junk_prices)}")
            for jp in junk_prices[:3]:
                print(f"   Junk Price Record: market='{jp.get('market')}', min={jp.get('min_price')}, modal={jp.get('modal_price')}, max={jp.get('max_price')}, date={jp.get('arrival_date')}")

            # 2. Inverted min/max: min > modal or modal > max
            inverted = [
                r for r in records
                if float(r.get('min_price') or 0) > float(r.get('modal_price') or 0)
                or float(r.get('modal_price') or 0) > float(r.get('max_price') or 0)
            ]
            print(f"Inverted Min/Max Count: {len(inverted)}")
            for inv in inverted[:3]:
                print(f"   Inverted Record: market='{inv.get('market')}', min={inv.get('min_price')}, modal={inv.get('modal_price')}, max={inv.get('max_price')}")

            # 3. Check presence of arrival volume / quintals
            has_arrival = any('arrival' in r or 'arrival_quintals' in r for r in records)
            print(f"Has arrival_quintals field: {has_arrival}")
