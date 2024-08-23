import os
from typing import List, Dict
from langchain_huggingface import HuggingFaceEmbeddings
from supabase import create_client
import json
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# Supabase setup
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase = create_client(url, key)

# HuggingFace Embeddings setup for conversation history and blood test results
hf_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def embed_conversation_message(message: Dict) -> Dict:
    vector = hf_embeddings.embed_query(message['content'])
    return {
        "content": message['content'],
        "embedding": vector,  # Store as vector directly
        "metadata": json.dumps({
            "source": "conversation",
            "type": "message",
            "message_type": message['type'],
            "timestamp": message['timestamp']
        })
    }

def embed_blood_test_results(results: str) -> Dict:
    vector = hf_embeddings.embed_query(results)
    return {
        "content": results,
        "embedding": vector,  # Store as vector directly
        "metadata": json.dumps({
            "source": "blood_test",
            "type": "test_results",
            "timestamp": datetime.utcnow().isoformat()
        })
    }

def upsert_to_db(chunks: List[Dict], clerk_user_id: str):
    current_time = datetime.utcnow().isoformat()
    for chunk in chunks:
        chunk["clerkUserId"] = clerk_user_id
        chunk["createdAt"] = current_time
        chunk["updatedAt"] = current_time
    try:
        supabase.table("BloodTestData").upsert(chunks).execute()
    except Exception as e:
        print(f"Error upserting to BloodTestData: {str(e)}")

def load_conversation_history(conversation: List[Dict], clerk_user_id: str):
    try:
        embedded_messages = [embed_conversation_message(message) for message in conversation]
        upsert_to_db(embedded_messages, clerk_user_id)
    except Exception as e:
        print(f"Error loading conversation history: {str(e)}")

def load_blood_test_results(results: str, clerk_user_id: str):
    try:
        embedded_results = embed_blood_test_results(results)
        upsert_to_db([embedded_results], clerk_user_id)
        print("Blood test results loaded and stored.")
    except Exception as e:
        print(f"Error loading blood test results: {str(e)}")

# Function to be called from chatbot.py to update conversation memory
def update_conversation_memory(new_messages: List[Dict], clerk_user_id: str):
    load_conversation_history(new_messages, clerk_user_id)

# Function to be called from chatbot.py to load initial blood test results
def initialize_blood_test_results(results: str, clerk_user_id: str):
    load_blood_test_results(results, clerk_user_id)