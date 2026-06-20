import csv
import os

FILE = "driver_cash.csv"
HEADERS = [
    "Date", "Truck No", "Driver Name", "Opening Cash",
    "Offline Advance Received", "Online Advance Received",
    "Diesel Expense", "Maintenance Expense", "Food Expense", "Other Expense",
    "Total Offline Expenses", "Calculated Closing Cash", "Actual Closing Cash",
    "Cash Difference", "Remarks"
]

if not os.path.exists(FILE):
    with open(FILE, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(HEADERS)

while True:
    print("\n===== DRIVER CASH ENTRY =====")

    date = input("Date (DD-MM-YYYY): ").strip()
    truck_no = input("Truck No: ").strip()
    driver_name = input("Driver Name: ").strip()

    try:
        opening_cash = float(input("Opening Cash (₹): ") or 0)
        advance_offline = float(input("Advance Received (Offline/Cash) (₹): ") or 0)
        advance_online = float(input("Advance Received (Online/Digital) (₹): ") or 0)

        diesel_expense = float(input("Diesel Expense (₹): ") or 0)
        maintenance_expense = float(input("Maintenance Expense (₹): ") or 0)
        food_expense = float(input("Food Expense (₹): ") or 0)
        other_expense = float(input("Other Expense (₹): ") or 0)

        actual_closing = float(input("Actual Closing Cash (₹): ") or 0)
    except ValueError:
        print("Error: Inputs must be numeric. Please re-enter this record.")
        continue

    remarks = input("Remarks: ").strip()

    total_expense = (
        diesel_expense +
        maintenance_expense +
        food_expense +
        other_expense
    )

    calculated_closing = (
        opening_cash +
        advance_offline -
        total_expense
    )

    difference = actual_closing - calculated_closing

    print("\n===== CASH SUMMARY =====")
    print(f"Total Offline Expenses  : ₹{total_expense:.2f}")
    print(f"Calculated Closing Cash : ₹{calculated_closing:.2f}")
    print(f"Actual Closing Cash     : ₹{actual_closing:.2f}")
    print(f"Cash Difference         : ₹{difference:.2f}")

    with open(FILE, "a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow([
            date,
            truck_no,
            driver_name,
            opening_cash,
            advance_offline,
            advance_online,
            diesel_expense,
            maintenance_expense,
            food_expense,
            other_expense,
            total_expense,
            calculated_closing,
            actual_closing,
            difference,
            remarks
        ])

    print("Record Saved!")

    if input("Add More? (Y/N): ").upper() != "Y":
        break