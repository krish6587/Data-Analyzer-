from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
import io
import os
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allows your HTML page to communicate with this server from any origin

# Directory where HTML files are located
HTML_DIR = os.path.dirname(os.path.abspath(__file__))

# In-memory OTP storage: { email: { "otp": "123456", "verified": False } }
otp_store = {}


@app.route("/")
def index():
    return send_from_directory(HTML_DIR, "home.html")


@app.route("/login.html")
def login_page():
    return send_from_directory(HTML_DIR, "login.html")


@app.route("/registration.html")
def registration_page():
    return send_from_directory(HTML_DIR, "registration.html")


@app.route("/home.html")
def home_page():
    return send_from_directory(HTML_DIR, "home.html")


@app.route("/styles.css")
def styles():
    return send_from_directory(HTML_DIR, "styles.css")


@app.route("/app.js")
def app_js():
    return send_from_directory(HTML_DIR, "app.js")


@app.route("/dataset.csv")
def dataset():
    return send_from_directory(HTML_DIR, "dataset.csv")


# ===================== EMAIL OTP VERIFICATION =====================

@app.route("/send-otp", methods=["POST"])
def send_otp():
    data = request.json
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    otp_store[email] = {"otp": otp, "verified": False}

    # Send OTP via email
    try:
        sender_email = os.getenv("EMAIL_ADDRESS")
        sender_password = os.getenv("EMAIL_PASSWORD")

        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = email
        msg["Subject"] = "Your Verification Code — Data Analyzer"

        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #f9fafb; padding: 30px; border-radius: 12px; border: 1px solid #e5e7eb;">
                <h2 style="color: #4f46e5; margin-top: 0;">📊 Data Analyzer</h2>
                <p style="color: #374151; font-size: 16px;">Your verification code is:</p>
                <div style="background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
                    {otp}
                </div>
                <p style="color: #6b7280; font-size: 14px;">This code will expire when you close the registration page. Do not share this code with anyone.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(body, "html"))

        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, email, msg.as_string())
        server.quit()

        print(f"[OTP] Sent OTP {otp} to {email}")
        return jsonify({"message": "OTP sent successfully!"}), 200

    except Exception as e:
        print(f"[OTP ERROR] {str(e)}")
        return jsonify({"error": f"Failed to send OTP: {str(e)}"}), 500


@app.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email", "").strip().lower()
    user_otp = data.get("otp", "").strip()

    if not email or not user_otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    stored = otp_store.get(email)

    if not stored:
        return jsonify({"error": "No OTP found. Please request a new one."}), 400

    if stored["otp"] == user_otp:
        otp_store[email]["verified"] = True
        return jsonify({"message": "Email verified successfully!", "verified": True}), 200
    else:
        return jsonify({"error": "Invalid OTP. Please try again.", "verified": False}), 400


@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    email = data.get("email", "").strip().lower()
    new_password = data.get("new_password", "")

    if not email or not new_password:
        return jsonify({"error": "Email and new password are required"}), 400

    # Check if email was verified via OTP
    stored = otp_store.get(email)
    if not stored or not stored.get("verified"):
        return jsonify({"error": "Please verify your email with OTP first"}), 400

    # Validate password requirements (same as registration)
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    import re
    if not re.search(r'[0-9\W]', new_password):
        return jsonify({"error": "Password must contain a number or symbol"}), 400
    if not re.search(r'[a-z]', new_password) or not re.search(r'[A-Z]', new_password):
        return jsonify({"error": "Password must have uppercase & lowercase letters"}), 400

    # Update password in database
    hashed_password = generate_password_hash(new_password, method="pbkdf2:sha256")
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE username = %s", (email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"error": "No account found with this email"}), 404

        cursor.execute("UPDATE users SET password_hash = %s WHERE username = %s", (hashed_password, email))
        db.commit()

        # Clear OTP after successful reset
        del otp_store[email]

        return jsonify({"message": "Password reset successfully!"}), 200
    except Exception as e:
        return jsonify({"error": f"Failed to reset password: {str(e)}"}), 500
    finally:
        cursor.close()
        db.close()


# ==================================================================


# Helper function to get a fresh connection for every request
def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", "Krish@6587"),
        database=os.getenv("MYSQL_DATABASE", "auth_system"),
    )


@app.route("/register", methods=["POST"])
def register():
    data = request.json
    username = data["username"]
    password = data["password"]

    # FIX: Explicitly set the hashing method to pbkdf2:sha256
    hashed_password = generate_password_hash(password, method="pbkdf2:sha256")

    # Open connection specific to this request
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        sql = "INSERT INTO users (username, password_hash) VALUES (%s, %s)"
        cursor.execute(sql, (username, hashed_password))
        db.commit()
        return jsonify({"message": "User registered successfully!"}), 201
    except mysql.connector.IntegrityError:
        return jsonify({"error": "An account with this email already exists."}), 400
    finally:
        # ALWAYS close the cursor and connection when done
        cursor.close()
        db.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data["username"]
    password = data["password"]

    # Open connection specific to this request
    db = get_db_connection()
    cursor = db.cursor(dictionary=True)

    try:
        sql = "SELECT * FROM users WHERE username = %s"
        cursor.execute(sql, (username,))
        user = cursor.fetchone()

        # Check if user exists AND password matches the hash
        if user and check_password_hash(user["password_hash"], password):
            return jsonify({"message": "Login successful!", "status": "success"}), 200
        else:
            return jsonify({"error": "Invalid username or password"}), 401
    finally:
        # ALWAYS close the cursor and connection when done
        cursor.close()
        db.close()


@app.route("/analyze", methods=["POST"])
def analyze_data():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    try:
        # Check file extension to determine how to read it
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file)
        elif file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(file)
        else:
            return jsonify({"error": "Unsupported file format. Please upload a CSV or Excel file."}), 400
            
        # Basic cleaning: drop completely empty rows/columns, fill NaNs with None for JSON serialization
        df = df.dropna(how='all')
        df = df.where(pd.notnull(df), None)
        
        # 1. Columns
        columns = df.columns.tolist()
        
        # 2. Preview data (first 50 rows to keep JSON small)
        preview_data = df.head(50).to_dict(orient='records')
        
        # 3. Summary Statistics for numeric columns
        numeric_df = df.select_dtypes(include=['number'])
        stats = []
        if not numeric_df.empty:
            desc = numeric_df.describe().to_dict()
            for col, stat_dict in desc.items():
                stats.append({
                    "column": col,
                    "count": round(stat_dict.get('count', 0), 2) if pd.notnull(stat_dict.get('count')) else 0,
                    "mean": round(stat_dict.get('mean', 0), 2) if pd.notnull(stat_dict.get('mean')) else 0,
                    "min": round(stat_dict.get('min', 0), 2) if pd.notnull(stat_dict.get('min')) else 0,
                    "max": round(stat_dict.get('max', 0), 2) if pd.notnull(stat_dict.get('max')) else 0,
                })
                
        # 4. Chart Data (Send up to 100 rows to the frontend for charting)
        chart_data = df.head(100).to_dict(orient='records')
        
        # Determine numeric and categorical columns for the frontend
        numeric_columns = numeric_df.columns.tolist()
        categorical_columns = df.select_dtypes(exclude=['number']).columns.tolist()
        
        return jsonify({
            "status": "success",
            "columns": columns,
            "numeric_columns": numeric_columns,
            "categorical_columns": categorical_columns,
            "data": preview_data,
            "chartData": chart_data,
            "stats": stats,
            "total_rows": len(df)
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Error processing file: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(port=5000, debug=False)
