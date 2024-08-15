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
import json
from datetime import datetime
import sys
import base64
import tempfile
import traceback
import logging

# Set up logging
logging.basicConfig(filename='get_email.log', level=logging.INFO)

# Load environment variables
load_dotenv()
logging.info("Environment variables loaded")

# Supabase setup
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)
logging.info("Supabase client created")

# Initialize the language model
llm = ChatOpenAI(temperature=0, model="gpt-4o-mini")
logging.info("Language model initialized")

def fetch_gmail_token():
    logging.info("Fetching Gmail token...")
    try:
        response = supabase.table("User").select("gmailAccessToken").execute()
        if not response.data or 'gmailAccessToken' not in response.data[0]:
            logging.info("No valid token found in the database.")
            return None
        logging.info("Gmail token fetched successfully")
        return response.data[0]['gmailAccessToken']
    except Exception as e:
        logging.error(f"An error occurred while fetching Gmail token: {e}")
        return None

def search_emails(token):
    logging.info("Searching emails...")
    credentials = Credentials(token=token)
    service = build('gmail', 'v1', credentials=credentials)
    query = 'subject:(blood test OR blood analysis OR lab OR blood OR hemoglobin)'
    results = service.users().messages().list(userId='me', q=query).execute()
    messages = results.get('messages', [])
    logging.info(f"Found {len(messages)} emails matching the search criteria")
    return messages

def process_pdf(file_data, filename):
    logging.info(f"Processing PDF: {filename}")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(file_data)
            temp_file_path = temp_file.name

        document = fitz.open(temp_file_path)
        text = ""
        for page in document:
            text += page.get_text()

        logging.info(f"Extracted text from PDF {filename}: {text[:100]}...")  # Print first 100 characters

        prompt = f"""
        The following is a block of text extracted from a blood test report. Extract the relevant blood test results and the date of the report. Structure them according to the following schema:

        {BloodTestResults.schema_json(indent=2)}

        Please do not specify that data is in JSON format.

        Text:
        {text}

        Structured Results:
        """

        logging.info("Sending prompt to language model...")
        response = llm.invoke(prompt)
        logging.info(f"LLM response for {filename}: {response.content}")
        logging.info(f"Received response from language model for {filename}")

        extracted_data = json.loads(response.content)
        
        for key, value in extracted_data.items():
            if isinstance(value, bytes):
                extracted_data[key] = value.decode('utf-8', errors='replace')

        os.unlink(temp_file_path)  # Delete the temporary file
        logging.info(f"Successfully processed {filename}")
        return extracted_data
    except Exception as e:
        logging.error(f"An error occurred while processing the PDF {filename}: {e}")
        return None

def get_email_details(service, message_id):
    logging.info(f"Getting details for email {message_id}")
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
                    'data': file_data
                })
                logging.info(f"Found attachment: {part['filename']}")
        logging.info(f"Retrieved {len(attachments)} attachments for email {message_id}")
        return attachments
    except Exception as e:
        logging.error(f"An error occurred while processing message {message_id}: {e}")
    return None

def search_and_retrieve_emails(token):
    logging.info("Searching and retrieving emails...")
    credentials = Credentials(token=token)
    service = build('gmail', 'v1', credentials=credentials)
    messages = search_emails(token)
    attachments = []
    for message in messages:
        email_attachments = get_email_details(service, message['id'])
        if email_attachments:
            attachments.extend(email_attachments)
    logging.info(f"Total attachments found: {len(attachments)}")
    return attachments

def format_date(date_string):
    logging.info(f"Formatting date: {date_string}")
    if not date_string:
        logging.info("Empty date string received")
        return None
    try:
        date = datetime.fromisoformat(date_string.split('T')[0])
        formatted = date.strftime('%d/%m/%y')
        logging.info(f"Formatted date: {formatted}")
        return formatted
    except ValueError:
        logging.error(f"Invalid date format: {date_string}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error in format_date: {e}")
        return None

def transform_results_to_list_of_dicts(results):
    logging.info("Transforming results to list of dictionaries...")
    processed_data = []
    for i, result in enumerate(results):
        try:
            result_dict = result  # The result is already a dictionary

            if 'report_date' not in result_dict:
                logging.warning(f"Warning: 'report_date' missing in result {i}")
                continue

            formatted_date = format_date(result_dict['report_date'])
            if formatted_date is None:
                logging.warning(f"Warning: Invalid date in result {i}")
                continue

            row = {
                'Date': formatted_date,
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
            logging.info(f"Processed result {i}")
        except Exception as e:
            logging.error(f"Unexpected error processing result {i}: {e}")
    
    if not processed_data:
        logging.warning("Warning: No valid data to create list of dictionaries")
        return []

    logging.info(f"List of dictionaries created with {len(processed_data)} items")
    
    # Sort the list of dictionaries by date
    processed_data.sort(key=lambda x: datetime.strptime(x['Date'], '%d/%m/%y'))
    
    logging.info("List of dictionaries transformation completed")
    return processed_data

# Main execution
if __name__ == "__main__":
    try:
        token = fetch_gmail_token()
        if token:
            email_attachments = search_and_retrieve_emails(token)
            results = []
            for attachment in email_attachments:
                result = process_pdf(attachment['data'], attachment['filename'])
                if result:
                    results.append(result)
            processed_results = transform_results_to_list_of_dicts(results)
            print(json.dumps({"bloodTestResults": processed_results}))
        else:
            print(json.dumps({"error": "No valid token available.", "bloodTestResults": []}))
    except Exception as e:
        print(json.dumps({"error": str(e), "bloodTestResults": []}))