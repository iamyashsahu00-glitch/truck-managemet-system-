import os
import csv
import sys
from functools import wraps
from flask import Flask, jsonify, request, render_template, send_from_directory, session, redirect, url_for

app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.environ.get("SECRET_KEY", "fleetentry-secure-key-2026")

# Predefined Roles and Users database
USERS = {
    "owner": {"password": "owner123", "role": "Owner", "display_name": "Fleet Owner"},
    "staff": {"password": "staff123", "role": "Staff", "display_name": "Operations Staff"}
}

# Session Decorators
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            if request.path.startswith('/api/'):
                return jsonify({"success": False, "error": "Unauthorized. Please log in."}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def owner_only(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = session.get('user')
        if not user or user.get('role') != 'Owner':
            if request.path.startswith('/api/'):
                return jsonify({"success": False, "error": "Forbidden. Owners only."}), 403
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

TRIP_FILE = "trip_details.csv"
CASH_FILE = "driver_cash.csv"

def init_csv_files():
    # Initialize Trip Details CSV
    if not os.path.exists(TRIP_FILE):
        with open(TRIP_FILE, "w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow([
                "Date", "From", "To", "Load Type", "Freight Amount",
                "Customer Name", "Received Amount", "Pending Amount"
            ])
    
    new_headers = [
        "Date", "Truck No", "Driver Name", "Opening Cash",
        "Offline Advance Received", "Online Advance Received",
        "Diesel Expense", "Maintenance Expense", "Food Expense", "Other Expense",
        "Total Offline Expenses", "Calculated Closing Cash", "Actual Closing Cash",
        "Cash Difference", "Remarks"
    ]
    
    # Check if Driver Cash CSV needs migration
    if os.path.exists(CASH_FILE):
        try:
            with open(CASH_FILE, "r", newline="", encoding="utf-8") as file:
                reader = csv.reader(file)
                headers = next(reader, [])
        except Exception:
            headers = []
            
        if headers and "Advance Received" in headers:
            print("Migrating driver_cash.csv to new schema...", flush=True)
            backup_file = "driver_cash_backup.csv"
            try:
                if os.path.exists(backup_file):
                    os.remove(backup_file)
                os.rename(CASH_FILE, backup_file)
                with open(backup_file, "r", newline="", encoding="utf-8") as infile, \
                     open(CASH_FILE, "w", newline="", encoding="utf-8") as outfile:
                    reader = csv.DictReader(infile)
                    writer = csv.writer(outfile)
                    writer.writerow(new_headers)
                    for row in reader:
                        try:
                            opening = float(row.get("Opening Cash") or 0)
                            adv = float(row.get("Advance Received") or 0)
                            diesel = float(row.get("Diesel Expense") or 0)
                            maint = float(row.get("Maintenance Expense") or 0)
                            food = float(row.get("Food Expense") or 0)
                            other = float(row.get("Other Expense") or 0)
                            closing = float(row.get("Closing Cash") or 0)
                        except ValueError:
                            opening = adv = diesel = maint = food = other = closing = 0.0
                            
                        total_exp = diesel + maint + food + other
                        writer.writerow([
                            row.get("Date", ""),
                            row.get("Truck No", ""),
                            row.get("Driver Name", ""),
                            opening,
                            adv,  # Offline Advance
                            0.0,  # Online Advance
                            diesel,
                            maint,
                            food,
                            other,
                            total_exp,
                            closing,  # Calculated Closing
                            closing,  # Actual Closing
                            0.0,  # Cash Difference
                            row.get("Remarks", "")
                        ])
                print("Migration of driver_cash.csv completed successfully.", flush=True)
            except Exception as e:
                print(f"Error migrating driver_cash.csv: {e}", file=sys.stderr)
                if os.path.exists(backup_file) and not os.path.exists(CASH_FILE):
                    os.rename(backup_file, CASH_FILE)
                    
    # Initialize Driver Cash CSV if it does not exist
    if not os.path.exists(CASH_FILE):
        with open(CASH_FILE, "w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(new_headers)

init_csv_files()

# Helper function to read csv into list of dicts
def read_csv(filename):
    if not os.path.exists(filename):
        return []
    records = []
    try:
        with open(filename, "r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                records.append(row)
    except Exception as e:
        print(f"Error reading {filename}: {e}", file=sys.stderr)
    return records

# Helper function to write a row to a csv
def append_to_csv(filename, row_list):
    try:
        with open(filename, "a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(row_list)
        return True
    except Exception as e:
        print(f"Error appending to {filename}: {e}", file=sys.stderr)
        return False

# Helper function to delete a row from a csv at a given 0-based data index
def delete_row_from_csv(filename, index):
    if not os.path.exists(filename):
        return False
    try:
        rows = []
        with open(filename, "r", newline="", encoding="utf-8") as file:
            reader = csv.reader(file)
            header = next(reader)
            rows = list(reader)
        
        if index < 0 or index >= len(rows):
            return False
            
        del rows[index]
        
        with open(filename, "w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(header)
            writer.writerows(rows)
        return True
    except Exception as e:
        print(f"Error deleting row from {filename}: {e}", file=sys.stderr)
        return False

@app.route('/')
@login_required
def index():
    return render_template('index.html', user=session['user'])

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user' in session:
        return redirect(url_for('index'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip().lower()
        password = request.form.get('password', '')
        user_record = USERS.get(username)
        if user_record and user_record['password'] == password:
            session['user'] = {
                'username': username,
                'role': user_record['role'],
                'display_name': user_record['display_name']
            }
            return redirect(url_for('index'))
        else:
            error = "Invalid username or password."
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

# --- API ENDPOINTS ---

# Trip Details APIs
@app.route('/api/trips', methods=['GET'])
@login_required
def get_trips():
    trips = read_csv(TRIP_FILE)
    for i, trip in enumerate(trips):
        trip['id'] = i
    return jsonify(trips)

@app.route('/api/trips', methods=['POST'])
@login_required
def add_trip():
    data = request.get_json() or {}
    
    # Validate required fields
    required_fields = ["date", "from_city", "to_city", "load_type", "freight_amount", "customer_name", "received_amount"]
    for f in required_fields:
        if f not in data or str(data[f]).strip() == "":
            return jsonify({"success": False, "error": f"Field '{f}' is required."}), 400
            
    try:
        freight = float(data["freight_amount"])
        received = float(data["received_amount"])
        pending = freight - received
    except ValueError:
        return jsonify({"success": False, "error": "Freight and Received amounts must be numeric."}), 400
        
    date = str(data["date"]).strip()
    from_city = str(data["from_city"]).strip()
    to_city = str(data["to_city"]).strip()
    load_type = str(data["load_type"]).strip()
    customer_name = str(data["customer_name"]).strip()
    
    success = append_to_csv(TRIP_FILE, [
        date, from_city, to_city, load_type, freight,
        customer_name, received, pending
    ])
    
    if success:
        return jsonify({"success": True, "message": "Trip detail saved successfully!"})
    else:
        return jsonify({"success": False, "error": "Failed to save record to CSV."}), 500

@app.route('/api/trips/<int:index>', methods=['DELETE'])
@login_required
@owner_only
def delete_trip(index):
    success = delete_row_from_csv(TRIP_FILE, index)
    if success:
        return jsonify({"success": True, "message": "Trip detail entry deleted successfully!"})
    else:
        return jsonify({"success": False, "error": "Failed to delete trip entry or index out of range."}), 500

# Driver Cash APIs
@app.route('/api/driver-cash', methods=['GET'])
@login_required
def get_driver_cash():
    records = read_csv(CASH_FILE)
    for i, rec in enumerate(records):
        rec['id'] = i
    return jsonify(records)

@app.route('/api/driver-cash', methods=['POST'])
@login_required
def add_driver_cash():
    data = request.get_json() or {}
    
    required_fields = ["date", "truck_no", "driver_name", "opening_cash", 
                       "advance_received_offline", "advance_received_online",
                       "diesel_expense", "maintenance_expense", "food_expense", "other_expense",
                       "actual_closing_cash"]
    for f in required_fields:
        if f not in data or str(data[f]).strip() == "":
            return jsonify({"success": False, "error": f"Field '{f}' is required."}), 400
            
    try:
        opening = float(data["opening_cash"])
        advance_offline = float(data["advance_received_offline"])
        advance_online = float(data["advance_received_online"])
        diesel = float(data["diesel_expense"])
        maintenance = float(data["maintenance_expense"])
        food = float(data["food_expense"])
        other = float(data["other_expense"])
        actual_closing = float(data["actual_closing_cash"])
    except ValueError:
        return jsonify({"success": False, "error": "Cash and expense inputs must be numeric."}), 400
        
    date = str(data["date"]).strip()
    truck_no = str(data["truck_no"]).strip()
    driver_name = str(data["driver_name"]).strip()
    remarks = str(data.get("remarks", "")).strip()
    
    total_expense = diesel + maintenance + food + other
    calculated_closing = opening + advance_offline - total_expense
    cash_difference = actual_closing - calculated_closing
    
    success = append_to_csv(CASH_FILE, [
        date, truck_no, driver_name, opening,
        advance_offline, advance_online,
        diesel, maintenance, food, other,
        total_expense, calculated_closing, actual_closing, cash_difference,
        remarks
    ])
    
    if success:
        return jsonify({"success": True, "message": "Driver cash record saved successfully!"})
    else:
        return jsonify({"success": False, "error": "Failed to save record to CSV."}), 500

@app.route('/api/driver-cash/<int:index>', methods=['DELETE'])
@login_required
@owner_only
def delete_driver_cash(index):
    success = delete_row_from_csv(CASH_FILE, index)
    if success:
        return jsonify({"success": True, "message": "Driver cash entry deleted successfully!"})
    else:
        return jsonify({"success": False, "error": "Failed to delete driver cash entry or index out of range."}), 500

# Reports APIs
@app.route('/api/reports/summary', methods=['GET'])
@login_required
@owner_only
def get_dashboard_summary():
    trips = read_csv(TRIP_FILE)
    cash_records = read_csv(CASH_FILE)
    
    # Calculate Trip Summary
    total_trips = len(trips)
    total_freight = 0.0
    total_received = 0.0
    total_pending = 0.0
    
    for t in trips:
        try:
            total_freight += float(t.get("Freight Amount", 0) or 0)
            total_received += float(t.get("Received Amount", 0) or 0)
            total_pending += float(t.get("Pending Amount", 0) or 0)
        except ValueError:
            pass
            
    # Calculate Cash Summary
    total_opening = 0.0
    total_advance_offline = 0.0
    total_advance_online = 0.0
    total_diesel = 0.0
    total_maintenance = 0.0
    total_food = 0.0
    total_other = 0.0
    total_calculated_closing = 0.0
    total_actual_closing = 0.0
    total_difference = 0.0
    
    for c in cash_records:
        try:
            total_opening += float(c.get("Opening Cash", 0) or 0)
            total_advance_offline += float(c.get("Offline Advance Received", 0) or c.get("Advance Received", 0) or 0)
            total_advance_online += float(c.get("Online Advance Received", 0) or 0)
            total_diesel += float(c.get("Diesel Expense", 0) or 0)
            total_maintenance += float(c.get("Maintenance Expense", 0) or 0)
            total_food += float(c.get("Food Expense", 0) or 0)
            total_other += float(c.get("Other Expense", 0) or 0)
            total_calculated_closing += float(c.get("Calculated Closing Cash", 0) or c.get("Closing Cash", 0) or 0)
            total_actual_closing += float(c.get("Actual Closing Cash", 0) or c.get("Closing Cash", 0) or 0)
            total_difference += float(c.get("Cash Difference", 0) or 0)
        except ValueError:
            pass
            
    total_expenses = total_diesel + total_maintenance + total_food + total_other
    
    return jsonify({
        "trips": {
            "total_count": total_trips,
            "total_freight": total_freight,
            "total_received": total_received,
            "total_pending": total_pending
        },
        "cash": {
            "total_advance_offline": total_advance_offline,
            "total_advance_online": total_advance_online,
            "total_advance": total_advance_offline + total_advance_online,
            "total_expenses": total_expenses,
            "diesel_expense": total_diesel,
            "maintenance_expense": total_maintenance,
            "food_expense": total_food,
            "other_expense": total_other,
            "total_closing_sum": total_calculated_closing,
            "total_actual_closing_sum": total_actual_closing,
            "total_difference_sum": total_difference
        }
    })

@app.route('/api/reports/advances', methods=['GET'])
@login_required
@owner_only
def get_driver_advances():
    cash_records = read_csv(CASH_FILE)
    drivers = {}
    
    for c in cash_records:
        driver = c.get("Driver Name", "Unknown").strip()
        try:
            adv_offline = float(c.get("Offline Advance Received", 0) or c.get("Advance Received", 0) or 0)
            adv_online = float(c.get("Online Advance Received", 0) or 0)
        except ValueError:
            adv_offline = 0.0
            adv_online = 0.0
            
        if driver not in drivers:
            drivers[driver] = {
                "driver_name": driver,
                "total_advance_offline": 0.0,
                "total_advance_online": 0.0,
                "total_advance": 0.0,
                "entries_count": 0,
                "last_date": ""
            }
        drivers[driver]["total_advance_offline"] += adv_offline
        drivers[driver]["total_advance_online"] += adv_online
        drivers[driver]["total_advance"] += (adv_offline + adv_online)
        drivers[driver]["entries_count"] += 1
        drivers[driver]["last_date"] = c.get("Date", "")
        
    return jsonify(list(drivers.values()))

@app.route('/api/reports/expenses', methods=['GET'])
@login_required
@owner_only
def get_expense_ledger():
    cash_records = read_csv(CASH_FILE)
    ledger = []
    
    for c in cash_records:
        date = c.get("Date", "")
        truck = c.get("Truck No", "")
        driver = c.get("Driver Name", "")
        remarks = c.get("Remarks", "")
        
        for exp_type, col in [("Diesel", "Diesel Expense"), 
                              ("Maintenance", "Maintenance Expense"), 
                              ("Food", "Food Expense"), 
                              ("Other", "Other Expense")]:
            try:
                amt = float(c.get(col, 0) or 0)
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
                
    # Sort ledger by date descending
    # Assuming date is DD-MM-YYYY, let's sort simple text sorting or convert (we can sort in JS or simple reverse order for now)
    ledger.reverse()
    return jsonify(ledger)

@app.route('/api/reports/cash-report', methods=['GET'])
@login_required
@owner_only
def get_cash_report():
    # Returns cash report records: for each truck/driver combination, the flow of cash
    cash_records = read_csv(CASH_FILE)
    report = []
    
    for c in cash_records:
        try:
            opening = float(c.get("Opening Cash", 0) or 0)
            advance_offline = float(c.get("Offline Advance Received", 0) or c.get("Advance Received", 0) or 0)
            advance_online = float(c.get("Online Advance Received", 0) or 0)
            diesel = float(c.get("Diesel Expense", 0) or 0)
            maint = float(c.get("Maintenance Expense", 0) or 0)
            food = float(c.get("Food Expense", 0) or 0)
            other = float(c.get("Other Expense", 0) or 0)
            calculated_closing = float(c.get("Calculated Closing Cash", 0) or c.get("Closing Cash", 0) or 0)
            actual_closing = float(c.get("Actual Closing Cash", 0) or c.get("Closing Cash", 0) or 0)
            cash_difference = float(c.get("Cash Difference", 0) or 0)
        except ValueError:
            continue
            
        report.append({
            "date": c.get("Date", ""),
            "truck_no": c.get("Truck No", ""),
            "driver_name": c.get("Driver Name", ""),
            "opening": opening,
            "advance_offline": advance_offline,
            "advance_online": advance_online,
            "expenses": diesel + maint + food + other,
            "calculated_closing": calculated_closing,
            "actual_closing": actual_closing,
            "cash_difference": cash_difference,
            "remarks": c.get("Remarks", "")
        })
        
    report.reverse()
    return jsonify(report)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Truck Entry Web App server on port {port}...", flush=True)
    app.run(host='0.0.0.0', port=port, debug=True)
