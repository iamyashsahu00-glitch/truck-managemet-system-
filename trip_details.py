import csv
import os

FILE = "trip_details.csv"

if not os.path.exists(FILE):

    with open(FILE, "w", newline="") as file:

        writer = csv.writer(file)

        writer.writerow([
            "Date",
            "From",
            "To",
            "Load Type",
            "Freight Amount",
            "Customer Name",
            "Received Amount",
            "Pending Amount"
        ])

while True:

    print("\n===== TRIP DETAILS =====")

    date = input("Date: ")
    from_city = input("From: ")
    to_city = input("To: ")

    load_type = input("Load Type: ")

    freight_amount = float(
        input("Freight Amount: ")
    )

    customer_name = input(
        "Customer Name: "
    )

    received_amount = float(
        input("Received Amount: ")
    )

    pending_amount = (
        freight_amount -
        received_amount
    )

    print("Pending Amount :", pending_amount)

    with open(FILE, "a", newline="") as file:

        writer = csv.writer(file)

        writer.writerow([
            date,
            from_city,
            to_city,
            load_type,
            freight_amount,
            customer_name,
            received_amount,
            pending_amount
        ])

    print("Trip Saved!")

    if input("Add More? (Y/N): ").upper() != "Y":
        break