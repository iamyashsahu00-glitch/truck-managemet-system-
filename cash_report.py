import os
import csv

FILE = "driver_cash.csv"

def print_cash_report():
    if not os.path.exists(FILE):
        print(f"Error: {FILE} does not exist. Record some entries first.")
        return

    records = []
    try:
        with open(FILE, "r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                records.append(row)
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return

    if not records:
        print("No cash logs recorded yet.")
        return

    print("\n" + "=" * 125)
    print(" " * 50 + "FLEET CASH FLOW ANALYSIS REPORT")
    print("=" * 125)
    
    # Table Header
    header_fmt = "{:<10} | {:<12} | {:<15} | {:>10} | {:>12} | {:>12} | {:>10} | {:>12} | {:>12} | {:>10}"
    print(header_fmt.format(
        "Date", "Truck No", "Driver Name", "Opening", "Offline Adv", "Online Adv", "Expenses", "Calc Close", "Act Close", "Diff"
    ))
    print("-" * 125)

    for r in records:
        try:
            opening = float(r.get("Opening Cash") or 0)
            adv_off = float(r.get("Offline Advance Received") or r.get("Advance Received") or 0)
            adv_on = float(r.get("Online Advance Received") or 0)
            diesel = float(r.get("Diesel Expense") or 0)
            maint = float(r.get("Maintenance Expense") or 0)
            food = float(r.get("Food Expense") or 0)
            other = float(r.get("Other Expense") or 0)
            calc_close = float(r.get("Calculated Closing Cash") or r.get("Closing Cash") or 0)
            act_close = float(r.get("Actual Closing Cash") or r.get("Closing Cash") or 0)
            diff = float(r.get("Cash Difference") or 0)
        except ValueError:
            continue

        expenses = diesel + maint + food + other
        
        print(header_fmt.format(
            r.get("Date", ""),
            r.get("Truck No", ""),
            r.get("Driver Name", ""),
            f"₹{opening:.2f}",
            f"₹{adv_off:.2f}",
            f"₹{adv_on:.2f}",
            f"₹{expenses:.2f}",
            f"₹{calc_close:.2f}",
            f"₹{act_close:.2f}",
            f"₹{diff:.2f}"
        ))

    print("=" * 125)

if __name__ == "__main__":
    print_cash_report()
