# Hackathon-

## CV project shortlist API

On the student browse page, select **Upload CV and find matches** and choose a PDF, DOC, or DOCX file (up to 6 MB). The page sends the selected file as the `file` field in a `multipart/form-data` `POST` request to `http://127.0.0.1:8000/api/scan`, then displays the candidate summary and returned project shortlist. The FastAPI service in `server.py` must be running locally, and its CORS settings must allow the page's origin.

The API response includes a `candidate_summary` string and a `shortlist` array. Each shortlist item includes `project_title`, `match_score`, `skill_alignment`, `experience_alignment`, `interest_fit`, and `summary_reason`. Keep Gemini or other provider API keys on the backend, validate uploaded files and request sizes there, and avoid logging CV contents.
