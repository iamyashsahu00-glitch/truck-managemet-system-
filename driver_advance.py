import os
import csv

FILE = "driver_cash.csv"

def print_driver_advances():
    if not os.path.exists(FILE):
        print(f"Error: {FILE} does not exist. Record some entries first.")
        return

    drivers = {}
    try:
        with open(FILE, "r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                driver = row.get("Driver Name", "Unknown").strip()
                if not driver:
                    continue
                try:
                    adv_offline = float(row.get("Offline Advance Received") or row.get("Advance Received") or 0)
                    adv_online = float(row.get("Online Advance Received") or 0)
                except ValueError:
                    adv_offline = 0.0
                    adv_online = 0.0

                if driver not in drivers:
                    drivers[driver] = {
                        "offline": 0.0,
                        "online": 0.0,
                        "count": 0,
                        "last_date": ""
                    }
                drivers[driver]["offline"] += adv_offline
                drivers[driver]["online"] += adv_online
                drivers[driver]["count"] += 1
                drivers[driver]["last_date"] = row.get("Date", "")
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return

    if not drivers:
        print("No driver cash logs found.")
        return

    print("\n" + "=" * 95)
    print(" " * 32 + "DRIVER CASH ADVANCES SUMMARY")
    print("=" * 95)
    
    header_fmt = "{:<20} | {:>18} | {:>18} | {:>15} | {:>8} | {:<12}"
    print(header_fmt.format(
        "Driver Name", "Offline Adv (₹)", "Online Adv (₹)", "Total Adv (₹)", "Entries", "Last Date"
    ))
    print("-" * 95)

    for driver, data in drivers.items():
        total = data["offline"] + data["online"]
        print(header_fmt.format(
            driver,
            f"₹{data['offline']:.2f}",
            f"₹{data['online']:.2f}",
            f"₹{total:.2f}",
            str(data["count"]),
            data["last_date"]
        ))

    print("=" * 95)

if __name__ == "__main__":
    print_driver_advances()
