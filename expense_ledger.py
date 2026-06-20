import os
import csv

FILE = "driver_cash.csv"

def print_expense_ledger():
    if not os.path.exists(FILE):
        print(f"Error: {FILE} does not exist. Record some entries first.")
        return

    ledger = []
    try:
        with open(FILE, "r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                date = row.get("Date", "")
                truck = row.get("Truck No", "")
                driver = row.get("Driver Name", "")
                remarks = row.get("Remarks", "")
                
                for exp_type, col in [("Diesel", "Diesel Expense"), 
                                      ("Maintenance", "Maintenance Expense"), 
                                      ("Food", "Food Expense"), 
                                      ("Other", "Other Expense")]:
                    try:
                        amt = float(row.get(col, 0) or 0)
                    except ValueError:
                        amt = 0.0
                        
                    if amt > 0:
                        ledger.append({
                            "date": date,
                            "truck_no": truck,
                            "driver_name": driver,
                            "expense_type": exp_type,
                            "amount": amt,
                            "remarks": remarks
                        })
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return

    if not ledger:
        print("No expense ledger entries recorded.")
        return

    # Sort ledger by date descending (we will display in reverse chronological order)
    ledger.reverse()

    print("\n" + "=" * 95)
    print(" " * 32 + "FLEET EXPENSE LEDGER REPORT")
    print("=" * 95)
    
    header_fmt = "{:<12} | {:<12} | {:<18} | {:<12} | {:>12} | {:<20}"
    print(header_fmt.format(
        "Date", "Truck No", "Driver Name", "Category", "Amount", "Remarks"
    ))
    print("-" * 95)

    for item in ledger:
        print(header_fmt.format(
            item["date"],
            item["truck_no"],
            item["driver_name"],
            item["expense_type"],
            f"₹{item['amount']:.2f}",
            item["remarks"][:20] if item["remarks"] else "-"
        ))

    print("=" * 95)

if __name__ == "__main__":
    print_expense_ledger()
