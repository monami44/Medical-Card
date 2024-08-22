import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_huggingface import HuggingFaceEmbeddings
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv()

# Supabase setup
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase = create_client(url, key)

# HuggingFace Embeddings setup
hf_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def load_user_data(clerk_user_id, blood_test_results):
    logging.info(f"Loading user data for {clerk_user_id}")
    if blood_test_results is None:
        logging.warning(f"No blood test results provided for user {clerk_user_id}")
        return []  # Return an empty list instead of None
    logging.info(f"Received {len(blood_test_results)} blood test results")
    return blood_test_results