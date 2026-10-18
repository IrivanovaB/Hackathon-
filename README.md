# Hackathon-

## CV project shortlist API

The student browse page calls `POST /api/project-matches` when a student selects **Find CV matches**. The endpoint should be served by the app's backend (same origin, or with suitable CORS configuration); the static HTML alone does not provide AI matching.

The request is `multipart/form-data` with these fields:

- `cv`: the student's uploaded PDF, DOC, or DOCX file
- `profile`: JSON text containing `year`, `location`, `values`, `interests`, and `experience`
- `projects`: JSON text array of currently available projects. Each item contains `id`, `title`, `description`, `impact`, `skills`, `sector`, `location`, `hours`, `format`, and `requestedItem`

Return JSON in this format:

```json
{
	"matches": [
		{
			"projectId": 4,
			"score": 92,
			"reason": "Your experience with data and accessible web design fits this project."
		}
	]
}
```

Only return project IDs from the request, scores from 0 to 100, and short, evidence-based reasons. The client ignores unknown project IDs and displays at most five matches. Keep Gemini or other provider API keys on the backend, validate uploaded files and request sizes there, and avoid logging CV contents. The demo's sample CVs are filenames only; upload a real CV from the student profile to try matching.