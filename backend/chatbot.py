import os
from typing import List, Dict
from langchain_core.prompts import ChatPromptTemplate
from langchain_ollama.llms import OllamaLLM
from langchain.memory import ConversationBufferMemory
from langchain.schema import Document, BaseRetriever
from langchain_huggingface import HuggingFaceEmbeddings
from supabase import create_client
import json
import sys
import dotenv
import datetime
from langchain.schema import messages_from_dict, messages_to_dict
from load_memory import update_conversation_memory, initialize_blood_test_results
from pydantic import BaseModel, Field, Extra
from load_user import load_user_data
import subprocess

import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

logging.info("Starting script execution")

dotenv.load_dotenv()
logging.info("Environment variables loaded")

# Supabase setup
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    logging.error("Supabase URL or key not found in environment variables")
    sys.exit(1)
supabase = create_client(url, key)
logging.info("Supabase client created")

# Hugging Face Embeddings setup
try:
    hf_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    logging.info("HuggingFace Embeddings initialized")
    
    # Add this near the top of your file, after initializing hf_embeddings
    test_query = "This is a test query"
    test_embedding = hf_embeddings.embed_query(test_query)
    logging.info(f"Test embedding type: {type(test_embedding)}, length: {len(test_embedding)}")
    logging.info(f"First few elements of test embedding: {test_embedding[:5]}")
except Exception as e:
    logging.error(f"Error initializing HuggingFace Embeddings: {e}")
    sys.exit(1)

def query_db(query: str, clerk_user_id: str, top_k: int = 5) -> List[Dict]:
    logging.info(f"Querying database for user {clerk_user_id}")
    try:
        query_vector = hf_embeddings.embed_query(query)
        logging.info(f"Query vector type: {type(query_vector)}, length: {len(query_vector)}")
        logging.info(f"First few elements of query vector: {query_vector[:5]}")
        response = supabase.rpc(
            "match_blood_test_data",
            {
                "query_embedding": query_vector,
                "match_threshold": 0.95,
                "match_count": top_k,
                "clerk_user_id": clerk_user_id,
                "include_global": True  
            }
        ).execute()
        logging.info(f"Database query successful, returned {len(response.data)} results")
        return response.data
    except Exception as e:
        logging.error(f"Error querying database: {e}")
        return []

def check_embedding_structure():
    logging.info("Checking embedding structure")
    query_vector = hf_embeddings.embed_query("Test query")
    logging.info(f"Python embedding structure: {type(query_vector)}, length: {len(query_vector) if isinstance(query_vector, list) else 'Not a list'}")
    logging.info(f"First few elements: {query_vector[:5] if isinstance(query_vector, list) else query_vector}")

def check_db_embedding_structure():
    logging.info("Checking database embedding structure")
    try:
        response = supabase.table("BloodTestData").select("embedding").limit(1).execute()
        if response.data:
            embedding = response.data[0]['embedding']
            logging.info(f"Database embedding structure: {type(embedding)}")
            logging.info(f"First few elements: {embedding[:5] if isinstance(embedding, list) else embedding}")
        else:
            logging.info("No embeddings found in the database")
    except Exception as e:
        logging.error(f"Error checking database embedding structure: {e}")

class SupabaseRetriever(BaseRetriever):
    clerk_user_id: str = Field(...)

    class Config:
        extra = Extra.allow

    def get_relevant_documents(self, query: str) -> List[Document]:
        logging.info(f"Getting relevant documents for query: {query}")
        results = query_db(query, self.clerk_user_id)
        documents = [Document(page_content=r['content'], metadata=json.loads(r['metadata'])) for r in results]
        logging.info(f"Retrieved {len(documents)} relevant documents")
        return documents

    async def aget_relevant_documents(self, query: str) -> List[Document]:
        return self.get_relevant_documents(query)

def save_conversation(clerk_user_id: str, conversation: str):
    logging.info(f"Saving conversation for user {clerk_user_id}")
    try:
        # Convert conversation string to a list of messages
        messages = json.loads(conversation)
        # Use the update_conversation_memory function from load_memory.py
        update_conversation_memory(messages, clerk_user_id)
        logging.info("Conversation saved to vector store")
    except Exception as e:
        logging.error(f"Error saving conversation: {e}")

def retrieve_conversation(clerk_user_id: str) -> str:
    logging.info(f"Retrieving conversation for user {clerk_user_id}")
    try:
        response = supabase.table("BloodTestData").select("content", "metadata").eq("clerkUserId", clerk_user_id).execute()
        conversation_messages = []
        for r in response.data:
            metadata = json.loads(r['metadata'])
            if metadata.get('source') == 'conversation':
                try:
                    content = json.loads(r['content'])
                    conversation_messages.append(content)
                except json.JSONDecodeError:
                    logging.warning(f"Invalid JSON in conversation content: {r['content']}")
        if conversation_messages:
            logging.info("Conversation retrieved successfully")
            return json.dumps(conversation_messages)
        else:
            logging.info("No existing conversation found")
            return None
    except Exception as e:
        logging.error(f"Error retrieving conversation: {e}")
        return None

def get_blood_test_results(clerk_user_id: str) -> str:
    logging.info(f"Getting blood test results for user {clerk_user_id}")
    try:
        response = supabase.table("BloodTestData").select("content").or_(f"clerkUserId.eq.{clerk_user_id},accessType.eq.global").execute()
        results = [json.loads(r['content']) for r in response.data] if response.data else []
        logging.info(f"Retrieved {len(results)} blood test results")
        return json.dumps(results)
    except Exception as e:
        logging.error(f"Error getting blood test results: {e}")
        return "[]"

from langchain.chains import create_retrieval_chain
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

class MedicalChatbot:
    def __init__(self, clerk_user_id: str, blood_test_results: List[Dict] = None):
        logging.info(f"Initializing MedicalChatbot for user {clerk_user_id}")
        self.clerk_user_id = clerk_user_id
        try:
            self.llm = OllamaLLM(model="medichat-test")
            logging.info("OllamaLLM initialized")
        except Exception as e:
            logging.error(f"Error initializing OllamaLLM: {e}")
            raise
        self.retriever = SupabaseRetriever(clerk_user_id=clerk_user_id)
        self.memory = ConversationBufferMemory(return_messages=True)
        
        self.blood_test_results = load_user_data(clerk_user_id, blood_test_results)
        if self.blood_test_results:
            logging.info(f"Loaded {len(self.blood_test_results)} blood test results from email/file")
        else:
            logging.info("No blood test results available from email/file")

        existing_conversation = retrieve_conversation(clerk_user_id)
        if existing_conversation:
            logging.info("Existing conversation found. Attempting to parse.")
            try:
                parsed_conversation = json.loads(existing_conversation)
                if isinstance(parsed_conversation, list):
                    self.memory.chat_memory.messages = messages_from_dict(parsed_conversation)
                    logging.info(f"Loaded {len(parsed_conversation)} messages from existing conversation")
                else:
                    logging.warning("Existing conversation is not in the expected format. Starting with an empty conversation.")
            except json.JSONDecodeError:
                logging.error("Could not parse existing conversation. Starting with an empty conversation.")
        else:
            logging.info("No existing conversation found. Starting with an empty conversation.")

        template = """
        You are a medical assistant specializing in blood test analysis. Use the following pieces of context, the patient's blood test results, and the conversation history to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

        Context from database: {context}

        Patient's Blood Test Results from email/file:
        {blood_test_results}

        Conversation History:
        {history}

        Human: {question}

        Assistant: """

        self.prompt = ChatPromptTemplate.from_template(template)

        retrieval_prompt = ChatPromptTemplate.from_template("Please retrieve information relevant to: {input}")
        retrieval_chain = create_retrieval_chain(self.retriever, retrieval_prompt)

        self.qa_chain = (
            {
                "context": lambda x: retrieval_chain.invoke({"input": x["question"]})["answer"],
                "question": lambda x: x["question"],
                "blood_test_results": lambda x: json.dumps(self.blood_test_results, indent=2) if self.blood_test_results else "No blood test results available from email/file",
                "history": lambda x: self.get_conversation_history(),
            }
            | self.prompt
            | self.llm
            | StrOutputParser()
        )
        logging.info("MedicalChatbot initialization complete")

    def get_conversation_history(self) -> str:
        history = "\n".join([f"{m.type.capitalize()}: {m.content}" for m in self.memory.chat_memory.messages[-10:]])
        logging.info(f"Retrieved conversation history: {history[:100]}...")  # Log first 100 chars
        return history

    def process_message(self, message: str) -> str:
        logging.info(f"Processing message: {message}")
        try:
            response = self.qa_chain.invoke({
                "question": message,
            })
            logging.info(f"Generated response: {response[:100]}...")  # Log first 100 chars
            
            self.memory.chat_memory.add_user_message(message)
            self.memory.chat_memory.add_ai_message(response)
            
            # Update conversation memory in vector store
            new_messages = [
                {"type": "human", "content": message, "timestamp": datetime.datetime.utcnow().isoformat()},
                {"type": "ai", "content": response, "timestamp": datetime.datetime.utcnow().isoformat()}
            ]
            update_conversation_memory(new_messages, self.clerk_user_id)
            
            logging.info("Conversation saved to database")
            
            return response  # Return the response instead of printing it
        except Exception as e:
            logging.error(f"Error processing message: {e}")
            error_message = "I'm sorry, but I encountered an error while processing your message. Please try again later."
            return error_message  # Return the error message instead of printing it

    def generate_health_analysis(self) -> str:
        logging.info("Generating health analysis")
        try:
            analysis_prompt = """
            Using the provided blood test results {blood_test_results}, analyze each parameter and assess the overall health condition of the user. Compare the most recent blood test results with the previous two to evaluate the progression of each parameter. Identify any values that fall outside the normal reference range and highlight any concerning trends or significant changes over time. If any parameters show an anomaly, deteriorating trend, or critical value that may indicate a potential health risk, recommend that the user consult a healthcare professional. Please use the context provided in {context} to consider any relevant medical history or conditions that might influence the interpretation of the results.
            """
            
            response = self.qa_chain.invoke({
                "question": analysis_prompt,
            })
            logging.info(f"Generated health analysis: {response[:100]}...")  # Log first 100 chars
            return response
        except Exception as e:
            logging.error(f"Error generating health analysis: {e}")
            error_message = "I'm sorry, but I encountered an error while generating the health analysis. Please try again later."
            return error_message

def get_blood_test_results(clerk_user_id):
    try:
        # Run the get_email.py script and capture its output
        result = subprocess.run(['python', 'backend/get_email.py'], capture_output=True, text=True, check=True)
        output = json.loads(result.stdout)
        
        if 'error' in output:
            logging.error(f"Error in get_email.py: {output['error']}")
            return None
        
        return output['bloodTestResults']
    except subprocess.CalledProcessError as e:
        logging.error(f"Error running get_email.py: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"Error parsing output from get_email.py: {e}")
        return None

def main():
    logging.info("Starting Medical Chatbot")
    if len(sys.argv) < 3:
        logging.error("Incorrect number of arguments")
        sys.exit(1)

    clerk_user_id = sys.argv[1]
    request_type = sys.argv[2]

    logging.info(f"Request type: {request_type}")

    blood_test_results = get_blood_test_results(clerk_user_id)

    try:
        check_db_embedding_structure()
        chatbot = MedicalChatbot(clerk_user_id, blood_test_results)
        logging.info("Medical Chatbot initialized successfully")

        if request_type == "health_analysis":
            logging.info("Generating health analysis")
            response = chatbot.generate_health_analysis()
            logging.info("Health analysis generated")
        else:
            user_question = " ".join(sys.argv[2:])
            logging.info(f"Processing user question: {user_question}")
            response = chatbot.process_message(user_question)

        print(f"HEALTH_ANALYSIS_START\n{response}\nHEALTH_ANALYSIS_END")
    except Exception as e:
        logging.error(f"Error in main execution: {e}")
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()