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
        return response.content
    except Exception as e:
        print(f"An error occurred while processing the PDF {path}: {e}")
        return None

def get_email_details(service, message_id, download_folder):
    try:
        # Fetch the email message
        message = service.users().messages().get(userId='me', id=message_id, format='full').execute()
        
        # Get the message parts
        parts = message['payload'].get('parts', [])
        
        # List to store paths of saved attachments
        saved_attachments = []
        
        # Iterate over each part of the email
        for part in parts:
            if part['filename']:
                # Check if the attachment data is directly available
                data = part['body'].get('data', '')
                
                # If data is not directly available, fetch it using attachment ID
                if not data:
                    att_id = part['body']['attachmentId']
                    att = service.users().messages().attachments().get(userId='me', messageId=message_id, id=att_id).execute()
                    data = att['data']
                
                # Decode the attachment data
                file_data = urlsafe_b64decode(data)
                
                # Save the attachment to the specified download folder
                path = os.path.join(download_folder, part['filename'])
                with open(path, 'wb') as f:
                    f.write(file_data)
                
                # Print a message indicating where the attachment was saved
                print(f'Attachment {part["filename"]} saved to {path}')
                
                # Append the saved path to the list
                saved_attachments.append(path)
        
        # Return the list of saved attachment paths
        return saved_attachments
    
    except Exception as e:
        print(f"An error occurred while retrieving the email details: {e}")
        return None

def search_and_retrieve_emails(token, download_folder):
    credentials = Credentials(token=token)
    service = build('gmail', 'v1', credentials=credentials)
    messages = search_emails(token)
    pdf_paths = []
    for message in messages:
        print("Retrieving details for Message ID:", message['id'])
        paths = get_email_details(service, message['id'], download_folder)
        if paths:
            pdf_paths.extend(paths)
    return pdf_paths

def transform_results_to_dataframe(results):
    processed_data = []
    for result in results:
        try:
            # Clean up the input string to make it a valid JSON
            clean_result = result.replace("```json\n", "").replace("\n```", "").strip()
            result_dict = json.loads(clean_result)
            # Dynamically create a DataFrame row
            row = {
                'Date & Time': pd.to_datetime(result_dict['report_date']).strftime('%d.%m.%Y %H:%M'),
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
            print(f"Error decoding JSON: {e}")
    return pd.DataFrame(processed_data)

def save_to_csv(data, csv_path):
    df = transform_results_to_dataframe(data)
    df.to_csv(csv_path, index=False)
    print(f"Data saved to {csv_path}")

# Main execution
if __name__ == "__main__":
    download_folder = '/Users/maksymliamin/medical-card/backend/attachments'
    token = fetch_gmail_token()
    if token:
        pdf_paths = search_and_retrieve_emails(token, download_folder)
        results = []
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [executor.submit(process_pdf, path) for path in pdf_paths]
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
        save_to_csv(results, 'blood_test_results.csv')
    else:
        print("No valid token available.")
