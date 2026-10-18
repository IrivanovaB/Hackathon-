import os
import json
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Load the GEMINI_API_KEY from .env
load_dotenv()

app = FastAPI()

# Allow your website frontend to communicate with this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Output structure
class ProjectMatch(BaseModel):
    project_id: str
    project_title: str
    match_score: int
    skill_alignment: List[str]
    experience_alignment: str
    interest_fit: str
    summary_reason: str

class ShortlistResponse(BaseModel):
    candidate_summary: str
    shortlist: List[ProjectMatch]

# Your Project List
PROJECT_DATABASE = [
    {
        "id": "PROJ-001",
        "title": "E-Commerce Web Design & Rebranding",
        "description": "Redesign a responsive storefront using Figma and Tailwind CSS.",
        "required_skills": ["Figma", "UI/UX", "Tailwind CSS", "Next.js"]
    },
    {
        "id": "PROJ-002",
        "title": "AI Analytics Pipeline",
        "description": "Build an ML pipeline using Python, SQL, and FastAPI to predict customer churn.",
        "required_skills": ["Python", "Machine Learning", "FastAPI", "SQL"]
    },
    {
        "id": "PROJ-003",
        "title": "Cross-Platform Mobile Fitness App",
        "description": "Develop a health/fitness tracking app for iOS/Android using Flutter.",
        "required_skills": ["Flutter", "Dart", "Mobile App Development", "Supabase"]
    }
]

@app.post("/api/scan", response_model=ShortlistResponse)
async def scan_cv(file: UploadFile = File(...)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not found in .env")

    client = genai.Client(api_key=api_key)

    # Read uploaded CV file directly into bytes
    file_bytes = await file.read()
    mime_type = file.content_type or "application/pdf"

    # Wrap the file in a Gemini Part object
    cv_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)

    prompt = f"""
    Analyze the attached CV/Resume against this database of projects:
    {json.dumps(PROJECT_DATABASE, indent=2)}

    Evaluate the candidate on:
    1. Technical & soft skills.
    2. Past work experience.
    3. Expressed or implied interests.

    Return the top matching projects, ordered from highest match_score to lowest.
    """

    try:
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=[cv_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ShortlistResponse,
                temperature=0.2,
            ),
        )
        return ShortlistResponse.model_validate_json(response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

 
