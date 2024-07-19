from openai import OpenAI
from models import BloodTestResults  
import json

client = OpenAI()

def process_blood_test_results(pdf_text):
    # Make a call to the LLM to parse the blood test values from the text
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Extract specific blood test results from the provided text and output in a structured JSON format."},
            {"role": "user", "content": pdf_text}
        ]
    )
    
    try:
        # Parse JSON-like structured data from LLM response into a dictionary
        blood_test_data = json.loads()(response.choices[0].message.content)  
        return BloodTestResults(**blood_test_data)
    except Exception as e:
        print(f"Error processing blood test results: {e}")
        return None