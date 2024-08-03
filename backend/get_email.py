import os
from dotenv import load_dotenv
from supabase import create_client, Client
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from base64 import urlsafe_b64decode
import fitz  # PyMuPDF
from models import BloodTestResults
from langchain_openai import ChatOpenAI
import concurrent.futures
import pandas as pd
import json
from datetime import datetime
from cryptography.fernet import Fernet
import sys
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# Load environment variables
load_dotenv()

# Supabase setup
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# Initialize the language model
llm = ChatOpenAI(temperature=0, model="gpt-4o-mini")

def fetch_gmail_token():
    try:
        response = supabase.table("User").select("gmailAccessToken").execute()
        if not response.data or 'gmailAccessToken' not in response.data[0]:
            raise Exception("No valid token found in the database.")
        return response.data[0]['gmailAccessToken']
    except Exception as e:
        print(f"An error occurred: {e}")
        return None

def search_emails(token):
    credentials = Credentials(token=token)
    service = build('gmail', 'v1', credentials=credentials)
    query = 'subject:(blood test OR blood analysis OR lab OR blood OR hemoglobin)'
    results = service.users().messages().list(userId='me', q=query).execute()
    return results.get('messages', [])

def process_pdf(path):
    try:
        document = fitz.open(path)
        text = ""
        for page in document:
            text += page.get_text()

        print(f"Extracted text from PDF: {text}")

        # Create a prompt for the LLM
        prompt = f"""
        The following is a block of text extracted from a blood test report. Extract the relevant blood test results and the date of the report. Structure them according to the following schema:

        {BloodTestResults.schema_json(indent=2)}

        Text:
        {text}

        Structured Results:
        """

        # Invoke the LLM to process the extracted text
        response = llm.invoke(prompt)
        print(f"Processed results for {path}:")
        print(response.content)  # Access the content attribute directly

        # Convert the response to a dictionary and return it
        extracted_data = json.loads(response.content)
        
        # Convert any bytes objects to strings
        for key, value in extracted_data.items():
            if isinstance(value, bytes):
                extracted_data[key] = value.decode('utf-8', errors='replace')

        return extracted_data
    except Exception as e:
        print(f"An error occurred while processing the PDF {path}: {e}")
        return None

def log(message):
    print(message, file=sys.stderr, flush=True)

def get_email_details(service, message_id):
    try:
        message = service.users().messages().get(userId='me', id=message_id).execute()
        attachments = []
        for part in message['payload']['parts']:
            if part['filename']:
                if 'data' in part['body']:
                    data = part['body']['data']
                else:
                    att_id = part['body']['attachmentId']
                    att = service.users().messages().attachments().get(userId='me', messageId=message_id, id=att_id).execute()
                    data = att['data']
                file_data = base64.urlsafe_b64decode(data.encode('UTF-8'))
                attachments.append({
                    'filename': part['filename'],
                    'data': base64.b64encode(file_data).decode('utf-8')
                })
                print(f"Found attachment: {part['filename']}", file=sys.stderr)
        return attachments
    except Exception as e:
        print(f"An error occurred while processing message {message_id}: {e}", file=sys.stderr)
    return None

def search_and_retrieve_emails(token):
    credentials = Credentials(token=token)
    service = build('gmail', 'v1', credentials=credentials)
    messages = search_emails(token)
    attachments = []
    for message in messages:
        email_attachments = get_email_details(service, message['id'])
        if email_attachments:
            attachments.extend(email_attachments)
    print(f"Total attachments found: {len(attachments)}", file=sys.stderr)
    return attachments

def format_date(date_string):
    if not date_string:
        print(f"Empty date string received")
        return None
    try:
        # Parse the ISO format date and ignore the time component
        date = datetime.fromisoformat(date_string.split('T')[0])
        return date.strftime('%d/%m/%y')  # Changed to lowercase 'y' for two-digit year
    except ValueError:
        print(f"Invalid date format: {date_string}")
        return None
    except Exception as e:
        print(f"Unexpected error in format_date: {e}")
        return None

def transform_results_to_dataframe(results):
    processed_data = []
    for i, result in enumerate(results):
        try:
            # Clean up the input string to make it a valid JSON
            clean_result = result.replace("```json\n", "").replace("\n```", "").strip()
            result_dict = json.loads(clean_result)
            
            # Check if 'report_date' exists in the result_dict
            if 'report_date' not in result_dict:
                print(f"Warning: 'report_date' missing in result {i}")
                continue

            formatted_date = format_date(result_dict['report_date'])
            if formatted_date is None:
                print(f"Warning: Invalid date in result {i}")
                continue

            # Dynamically create a DataFrame row
            row = {
                'Date': formatted_date,  # Changed from 'Date & Time' to just 'Date'
                'WBC': result_dict.get('WBC', None),
                'RBC': result_dict.get('RBC', None),
                'HGB': result_dict.get('HGB', None),
                'HCT': result_dict.get('HCT', None),
                'MCV': result_dict.get('MCV', None),
                'MCH': result_dict.get('MCH', None),
                'MCHC': result_dict.get('MCHC', None),
                'PLT': result_dict.get('PLT', None),
                'LYM%': result_dict.get('LYM_percent', None),
                'MXD%': result_dict.get('MXD_percent', None),
                'NEUT%': result_dict.get('NEUT_percent', None),
                'LYM#': result_dict.get('LYM_count', None),
                'MXD#': result_dict.get('MXD_count', None),
                'NEUT#': result_dict.get('NEUT_count', None),
                'RDW-SD': result_dict.get('RDW_SD', None),
                'RDW-CV': result_dict.get('RDW_CV', None),
                'PDW': result_dict.get('PDW', None),
                'MPV': result_dict.get('MPV', None),
                'P-LCR': result_dict.get('P_LCR', None),
                'PCT': result_dict.get('PCT', None)
            }
            processed_data.append(row)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON in result {i}: {e}")
        except Exception as e:
            print(f"Unexpected error processing result {i}: {e}")
    
    if not processed_data:
        print("Warning: No valid data to create DataFrame")
        return pd.DataFrame()

    df = pd.DataFrame(processed_data)
    
    print(f"DataFrame created with {len(df)} rows")
    print(f"Columns: {df.columns.tolist()}")
    
    if 'Date' not in df.columns:
        print("Warning: 'Date' column is missing")
        return df

    # Sort the DataFrame by date
    df['Date'] = pd.to_datetime(df['Date'], format='%d/%m/%y', errors='coerce')
    df = df.sort_values('Date').reset_index(drop=True)
    df['Date'] = df['Date'].dt.strftime('%d/%m/%y')
    
    return df

def prepare_data(results):
    df = transform_results_to_dataframe(results)
    if df.empty:
        print("Error: No data to prepare")
        return None
    processed_data = df.to_dict(orient='records')
    return processed_data

def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key

def encrypt_data(data):
    serialized_data = json.dumps(data, default=lambda x: base64.b64encode(x).decode('utf-8') if isinstance(x, bytes) else str(x))
    return fernet.encrypt(serialized_data.encode())

# Main execution
if __name__ == "__main__":
    try:
        token = fetch_gmail_token()
        user_id = sys.argv[1]
        password = sys.argv[2]

        # Fetch the salt from Supabase
        salt_response = supabase.table("UserEncryption").select("salt").eq("userId", user_id).execute()
        if salt_response.data:
            salt = base64.b64decode(salt_response.data[0]['salt'])
        else:
            raise Exception("Error: Salt not found for user")

        derived_key = derive_key(password, salt)
        fernet = Fernet(derived_key)

        if token:
            email_attachments = search_and_retrieve_emails(token)
            print(json.dumps({
                'attachments': email_attachments
            }))
        else:
            raise Exception("No valid token available.")
    except Exception as e:
        print(json.dumps({
            'error': str(e)
        }), file=sys.stderr)