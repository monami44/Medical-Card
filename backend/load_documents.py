import os
from typing import List, Dict
from langchain_huggingface import HuggingFaceEmbeddings
from supabase import create_client, Client
import json
from dotenv import load_dotenv
import fitz  # PyMuPDF
from datetime import datetime
from langchain_experimental.text_splitter import SemanticChunker
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

# Supabase setup
url: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

# HuggingFace Embeddings setup
hf_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Semantic Chunker using HuggingFace embeddings for reference books
openai_text_splitter = SemanticChunker(
    hf_embeddings, 
    breakpoint_threshold_type="gradient"
)

def chunk_and_embed_reference_book(text: str) -> List[Dict]:
    chunks = openai_text_splitter.create_documents([text])
    
    embedded_chunks = []
    for chunk in chunks:
        vector = hf_embeddings.embed_query(chunk.page_content)
        embedded_chunks.append({
            "content": chunk.page_content,
            "embedding": vector,
            "metadata": json.dumps({"source": "reference_book", **chunk.metadata}),
            "accessType": "global"
        })
    
    return embedded_chunks

def insert_to_db(chunks: List[Dict]):
    current_time = datetime.utcnow().isoformat()
    for chunk in chunks:
        chunk["createdAt"] = current_time
        chunk["updatedAt"] = current_time
        if "embedding" in chunk and chunk["embedding"] is not None:
            chunk["embedding"] = chunk["embedding"].tolist() if hasattr(chunk["embedding"], "tolist") else chunk["embedding"]
    
    try:
        supabase.table("BloodTestData").insert(chunks).execute()
        logging.info(f"Inserted {len(chunks)} chunks successfully")
    except Exception as e:
        logging.error(f"Error during insert: {str(e)}")
        raise

def load_reference_book(file_path: str):
    try:
        # Open the PDF file
        doc = fitz.open(file_path)
        
        # Extract text from all pages
        content = ""
        for page in doc:
            content += page.get_text()
        
        # Close the document
        doc.close()
        
        # Chunk and embed the content
        chunks = chunk_and_embed_reference_book(content)
        
        insert_to_db(chunks)
        logging.info(f"Reference book loaded and stored. Created {len(chunks)} chunks.")
    except Exception as e:
        logging.error(f"Error loading PDF: {str(e)}")

if __name__ == "__main__":
    reference_book_path = "/Users/maksymliamin/Desktop/Work/project_saved/public/blood_analysis_guidelines.pdf"
    load_reference_book(reference_book_path)