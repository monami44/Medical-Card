import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database connection details from environment variables
db_url = os.getenv('DIRECT_URL')

# Connect to the database
conn = psycopg2.connect(db_url)
conn.autocommit = True

try:
    with conn.cursor() as cur:
        # Read the SQL file
        with open('setup_database.sql', 'r') as file:
            sql_script = file.read()

        # Execute the SQL script
        cur.execute(sql_script)
        print("SQL script executed successfully")

except Exception as e:
    print(f"An error occurred: {e}")

finally:
    conn.close()