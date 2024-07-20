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
        The following is a block of text extracted from a blood test report. Extract the relevant blood test results and structure them according to the following schema:

        {BloodTestResults.schema_json(indent=2)}

        Text:
        {text}

        Structured Results:
        """

        # Invoke the LLM to process the extracted text
        response = llm.invoke(prompt)
        print(f"Processed results for {path}:")
        print(response.content)  # Access the content attribute directly

        # Here you can add logic to save the processed results to your database or perform further actions
    except Exception as e:
        print(f"An error occurred while processing the PDF {path}: {e}")

def get_email_details(service, message_id, download_folder):
    try:
        message = service.users().messages().get(userId='me', id=message_id, format='full').execute()
        parts = message['payload'].get('parts', [])
        for part in parts:
            if part['filename']:
                data = part['body'].get('data', '')
                if not data:
                    att_id = part['body']['attachmentId']
                    att = service.users().messages().attachments().get(userId='me', messageId=message_id, id=att_id).execute()
                    data = att['data']
                file_data = urlsafe_b64decode(data)
                path = os.path.join(download_folder, part['filename'])
                with open(path, 'wb') as f:
                    f.write(file_data)
                print(f'Attachment {part["filename"]} saved to {path}')
                if part['filename'].endswith('.pdf'):
                    return path
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
        path = get_email_details(service, message['id'], download_folder)
        if path:
            pdf_paths.append(path)
    return pdf_paths

# Main execution
if __name__ == "__main__":
    download_folder = '/Users/maksymliamin/medical-card/backend/attachments'
    token = fetch_gmail_token()
    if token:
        pdf_paths = search_and_retrieve_emails(token, download_folder)
        with concurrent.futures.ThreadPoolExecutor() as executor:
            executor.map(process_pdf, pdf_paths)
    else:
        print("No valid token available.")
