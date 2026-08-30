import os
import re
import json
import html
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
import requests
import chromadb
from huggingface_hub import InferenceClient

from dotenv import load_dotenv
load_dotenv()

app = FastAPI(
    title="Job Applier AI Service",
    description="FastAPI + ChromaDB Vector Search for job enrichment, ATS scoring, and semantic search.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY", os.getenv("HUGGINGFACEHUB_API_TOKEN", os.getenv("HF_TOKEN", "")))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ---------------------------------------------------------
# CHROMADB VECTOR STORE
# ---------------------------------------------------------
chroma_client = chromadb.Client()
jobs_collection = chroma_client.get_or_create_collection(
    name="job_openings",
    metadata={"hnsw:space": "cosine"}
)

# ---------------------------------------------------------
# COMPREHENSIVE SKILL DICTIONARY (for mining from descriptions)
# ---------------------------------------------------------
SKILL_DICTIONARY = [
    # Languages
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Golang", "Rust",
    "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "SQL", "Bash", "Shell",
    # Frontend
    "React", "React.js", "Next.js", "Vue", "Vue.js", "Angular", "Svelte", "HTML", "CSS",
    "TailwindCSS", "Tailwind", "Redux", "GraphQL", "REST API", "Webpack", "Vite",
    # Backend
    "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring Boot", "Spring",
    ".NET", "ASP.NET", "Rails", "Laravel", "NestJS", "Microservices",
    # Data / ML / AI
    "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "TensorFlow",
    "PyTorch", "Pandas", "NumPy", "Scikit-learn", "LLM", "GPT", "AI",
    "Data Science", "Data Engineering", "Data Analytics", "ETL", "Spark", "Hadoop",
    "Databricks", "Snowflake", "Airflow", "dbt",
    # Cloud / Infra
    "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "K8s",
    "Terraform", "CI/CD", "Jenkins", "GitHub Actions", "Linux", "Nginx",
    "Serverless", "Lambda", "CloudFormation", "Ansible",
    # Databases
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
    "Cassandra", "Firebase", "Supabase", "SQLite", "Oracle",
    # Tools / Practices
    "Git", "Agile", "Scrum", "Jira", "Figma", "System Design",
    "REST", "gRPC", "WebSocket", "OAuth", "JWT", "SSO",
    # Domain
    "Payments", "Fintech", "E-commerce", "SaaS", "B2B", "Security",
    "Compliance", "HIPAA", "SOC2", "GDPR", "Blockchain", "Crypto",
]

# ---------------------------------------------------------
# PYDANTIC SCHEMAS
# ---------------------------------------------------------

class ParsedProfileResponse(BaseModel):
    fullName: str
    email: str
    phone: str
    linkedinUrl: str
    githubUrl: str
    portfolioUrl: str
    yearsExperience: int
    skills: str
    resumeSummary: str
    jobPreferences: str

class EnrichJobRequest(BaseModel):
    jobTitle: str
    company: str
    description: str

class EnrichJobResponse(BaseModel):
    cleanSummary: str
    reqSkills: str
    minExp: str
    salaryRange: str
    refinedDescription: Optional[str] = None

class VectorSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 20

class VectorJobMatch(BaseModel):
    url: str
    title: str
    company: str
    similarityScore: int

class VectorSearchResponse(BaseModel):
    results: List[VectorJobMatch]

class MatchScoreRequest(BaseModel):
    resumeText: str
    jobDescription: str

class MatchScoreResponse(BaseModel):
    matchScore: int

class CoverLetterRequest(BaseModel):
    resumeText: str
    jobTitle: str
    company: str

class CoverLetterResponse(BaseModel):
    coverLetter: str

class AtsBreakdownRequest(BaseModel):
    resumeText: str
    jobTitle: str
    company: str
    jobDescription: str

class AtsBreakdownResponse(BaseModel):
    matchScore: int
    matchedSkills: List[str]
    missingSkills: List[str]
    recommendations: List[str]
    tailoredSummary: str

# ---------------------------------------------------------
# HELPER: Clean HTML to plain text
# ---------------------------------------------------------
def strip_html(raw: str) -> str:
    """Strip HTML tags, decode entities (including double-encoded), remove navigation noise."""
    # Double-unescape to handle &amp;lt; -> &lt; -> <
    text = html.unescape(html.unescape(raw))
    # Remove script/style/nav/footer/header blocks
    text = re.sub(r"<(script|style|nav|footer|header)[^>]*>[\s\S]*?</\1>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li[^>]*>", "\n• ", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|h[1-6]|tr|li|ul|ol)>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"(?i)skip\s+to\s+(main\s+)?content", "", text)
    # Clean nbsp and other unicode whitespace
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ---------------------------------------------------------
# HELPER: Extract role-specific content sections
# ---------------------------------------------------------
def extract_role_sections(text: str) -> dict:
    """
    Parse job description text into sections: responsibilities, requirements,
    qualifications, etc. Returns a dict of section_name -> content.
    """
    section_patterns = [
        (r"(?i)(what you.?ll do|responsibilities|your role|the role|key responsibilities|about the role|job description|what we.?re looking for in you)",
         "responsibilities"),
        (r"(?i)(requirements|qualifications|minimum qualifications|who you are|what you.?ll need|skills.*required|must.have|basic qualifications)",
         "requirements"),
        (r"(?i)(preferred|nice.to.have|bonus|plus|additional|desired)",
         "preferred"),
        (r"(?i)(benefits|perks|what we offer|compensation|pay|salary)",
         "benefits"),
    ]

    sections = {}
    lines = text.split("\n")
    current_section = "intro"
    sections["intro"] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        matched = False
        for pattern, name in section_patterns:
            if re.search(pattern, stripped) and len(stripped) < 120:
                current_section = name
                if name not in sections:
                    sections[name] = []
                matched = True
                break

        if not matched:
            if current_section not in sections:
                sections[current_section] = []
            sections[current_section].append(stripped)

    return sections


# ---------------------------------------------------------
# HELPER: Mine real skills from description text
# ---------------------------------------------------------
def mine_skills(text: str) -> List[str]:
    """Scan description text for real technical skills from the dictionary."""
    found = []
    text_lower = text.lower()
    for skill in SKILL_DICTIONARY:
        pattern = rf"\b{re.escape(skill)}\b"
        if re.search(pattern, text_lower, re.IGNORECASE):
            found.append(skill)
    return found


# ---------------------------------------------------------
# HELPER: Build structured summary from sections
# ---------------------------------------------------------
def build_summary_from_sections(sections: dict, job_title: str, company: str) -> str:
    """Build a 3-bullet structured summary from parsed job sections."""
    # Extract responsibility bullets
    resp_lines = sections.get("responsibilities", [])
    req_lines = sections.get("requirements", [])

    # Filter out short/noisy lines
    resp_bullets = [l for l in resp_lines if len(l) > 30 and not re.search(r"(?i)who we are|about (us|stripe|the company)|our mission|gdpr|equal opportunity", l)]
    req_bullets = [l for l in req_lines if len(l) > 30 and not re.search(r"(?i)who we are|about (us|stripe|the company)|our mission|gdpr|equal opportunity", l)]

    summary_parts = []

    # Responsibility
    if resp_bullets:
        top_resp = resp_bullets[:2]
        combined = "; ".join([r.lstrip("• -–").strip() for r in top_resp])
        summary_parts.append(f"Responsibilities: {combined[:200]}")
    else:
        summary_parts.append(f"Responsibilities: Drive core deliverables for {job_title} at {company}")

    # Requirements
    if req_bullets:
        top_req = req_bullets[:2]
        combined = "; ".join([r.lstrip("• -–").strip() for r in top_req])
        summary_parts.append(f"Requirements: {combined[:200]}")
    else:
        summary_parts.append(f"Requirements: Relevant domain expertise and industry experience")

    # Preferred / scope
    pref_lines = sections.get("preferred", [])
    pref_bullets = [l for l in pref_lines if len(l) > 20]
    if pref_bullets:
        combined = pref_bullets[0].lstrip("• -–").strip()
        summary_parts.append(f"Preferred: {combined[:150]}")
    elif resp_bullets and len(resp_bullets) > 2:
        combined = resp_bullets[2].lstrip("• -–").strip()
        summary_parts.append(f"Scope: {combined[:150]}")
    else:
        summary_parts.append(f"Scope: Cross-functional role collaborating with engineering and product teams")

    return "\n".join([f"• {p}" for p in summary_parts])


# ---------------------------------------------------------
# HELPER: Query AI LLM (Hugging Face / Groq / Fallback)
# ---------------------------------------------------------
def query_hf(prompt: str, max_tokens: int = 400) -> str:
    # 1. Try Groq API if key exists
    groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key and not groq_key.startswith("gsk_your"):
        try:
            res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": 0.1
                },
                timeout=8
            )
            if res.status_code == 200:
                out = res.json()["choices"][0]["message"]["content"]
                if out: return out.strip()
        except Exception as e:
            print("[Groq API Error]:", e)

    # 2. Try Hugging Face InferenceClient
    hf_token = os.getenv("HUGGINGFACE_API_KEY", os.getenv("HUGGINGFACEHUB_API_TOKEN", os.getenv("HF_TOKEN", "")))
    if hf_token and not hf_token.startswith("hf_your_huggingface"):
        client = InferenceClient(token=hf_token)
        hf_models = [
            "Qwen/Qwen2.5-Coder-32B-Instruct",
            "meta-llama/Llama-3.2-3B-Instruct",
            "microsoft/Phi-3-mini-4k-instruct"
        ]
        for model in hf_models:
            try:
                res = client.chat_completion(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=0.1
                )
                out = res.choices[0].message.content
                if out:
                    return out.strip()
            except Exception as e:
                print(f"[HF Model {model} Error]:", e)

    return ""


# ---------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Job Applier AI v3", "vectorCount": jobs_collection.count()}


@app.post("/api/ai/parse-cv", response_model=ParsedProfileResponse)
async def parse_cv(file: UploadFile = File(...)):
    raw_text = ""
    try:
        if file.filename.lower().endswith(".pdf"):
            reader = PdfReader(file.file)
            for page in reader.pages:
                raw_text += page.extract_text() + "\n"
        else:
            content = await file.read()
            raw_text = content.decode("utf-8", errors="ignore")
    except Exception as e:
        print("[PDF Extract Error]:", e)

    clean_text = re.sub(r"\s+", " ", raw_text).strip()

    email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", clean_text)
    phone_match = re.search(r"(\+?\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4})", clean_text)
    exp_match = re.search(r"(\d+)\+?\s*(?:-\s*\d+)?\s*(?:years?|yrs?)", clean_text, re.IGNORECASE)

    matched_skills = mine_skills(clean_text)

    full_name = ""
    email = email_match.group(1) if email_match else ""
    phone = phone_match.group(1) if phone_match else ""
    years_exp = int(exp_match.group(1)) if exp_match else 0
    skills_str = ", ".join(matched_skills) if matched_skills else ""
    summary = clean_text[:600] if len(clean_text) > 50 else ""
    preferences = f"Roles focusing on {skills_str}." if skills_str else ""

    if len(clean_text) > 50:
        prompt = f"Extract candidate info from this resume into JSON with keys: fullName, email, phone, yearsExperience, skills (array), resumeSummary (2 sentences), jobPreferences.\nResume:\n{clean_text[:1500]}"
        ai_out = query_hf(prompt, 350)
        json_match = re.search(r"\{[\s\S]*\}", ai_out)
        if json_match:
            try:
                parsed_json = json.loads(json_match.group(0))
                if parsed_json.get("fullName"): full_name = parsed_json["fullName"]
                if parsed_json.get("email"): email = parsed_json["email"]
                if parsed_json.get("phone"): phone = parsed_json["phone"]
                if parsed_json.get("yearsExperience"): years_exp = int(parsed_json["yearsExperience"])
                if parsed_json.get("skills"):
                    s = parsed_json["skills"]
                    skills_str = ", ".join(s) if isinstance(s, list) else str(s)
                if parsed_json.get("resumeSummary"): summary = parsed_json["resumeSummary"]
                if parsed_json.get("jobPreferences"): preferences = parsed_json["jobPreferences"]
            except Exception:
                pass

    return ParsedProfileResponse(
        fullName=full_name,
        email=email,
        phone=phone,
        linkedinUrl="",
        githubUrl="",
        portfolioUrl="",
        yearsExperience=years_exp,
        skills=skills_str,
        resumeSummary=summary,
        jobPreferences=preferences
    )


def refine_job_description_nlp(clean_text: str, job_title: str, company: str) -> str:
    """Section-aware NLP refiner that converts raw scraped text into clean structured Markdown offline."""
    sections = extract_role_sections(clean_text)
    parts = [f"## Role Overview\n**Position:** {job_title}\n**Company:** {company}"]

    if sections.get("responsibilities"):
        resp_lines = [l.lstrip("• -–").strip() for l in sections["responsibilities"] if len(l.strip()) > 15]
        if resp_lines:
            parts.append("## Key Responsibilities\n" + "\n".join([f"• {r}" for r in resp_lines[:10]]))

    if sections.get("requirements"):
        req_lines = [l.lstrip("• -–").strip() for l in sections["requirements"] if len(l.strip()) > 15]
        if req_lines:
            parts.append("## Qualifications & Technical Stack\n" + "\n".join([f"• {r}" for r in req_lines[:10]]))

    if sections.get("preferred"):
        pref_lines = [l.lstrip("• -–").strip() for l in sections["preferred"] if len(l.strip()) > 15]
        if pref_lines:
            parts.append("## Preferred Skills & Bonus Points\n" + "\n".join([f"• {r}" for r in pref_lines[:6]]))

    if sections.get("benefits"):
        ben_lines = [l.lstrip("• -–").strip() for l in sections["benefits"] if len(l.strip()) > 15]
        if ben_lines:
            parts.append("## Perks & Compensation\n" + "\n".join([f"• {b}" for b in ben_lines[:6]]))

    if len(parts) <= 1:
        clean_body = re.sub(r"(?i)(sign in|apply now|skip to (main )?content|cookie policy|equal opportunity).*", "", clean_text)
        parts.append(f"## Position Description\n{clean_body[:2000]}")

    return "\n\n".join(parts)


@app.post("/api/ai/enrich-job", response_model=EnrichJobResponse)
def enrich_job(req: EnrichJobRequest):
    raw_desc = req.description or ""
    job_title = req.jobTitle or ""
    company = req.company or ""

    # Step 1: Clean HTML to structured plain text (preserving bullet/paragraph structure)
    clean_text = strip_html(raw_desc)

    # Step 2: Parse into sections (responsibilities, requirements, preferred, benefits)
    sections = extract_role_sections(clean_text)

    # Step 3: Mine real skills from full description text
    mined_skills = mine_skills(clean_text)

    # Step 4: Try ChatModel LLM for intelligent summary
    clean_summary = ""
    req_skills_str = ""
    min_exp = ""
    salary_range = ""

    prompt = (
        f"Analyze this job posting for '{job_title}' at '{company}'.\n\n"
        f"JOB CONTENT:\n{clean_text[:2500]}\n\n"
        f"Return JSON with:\n"
        f'{{"cleanSummary": "• Responsibilities: [2 key duties from the posting]\\n• Requirements: [key qualifications and skills needed]\\n• Scope: [team/project impact]", '
        f'"reqSkills": "comma separated technical skills mentioned", '
        f'"minExp": "e.g. 5+ Years or Not Specified", '
        f'"salaryRange": "e.g. $120k-$180k or Competitive"}}'
    )

    ai_out = query_hf(prompt, 400)
    json_match = re.search(r"\{[\s\S]*\}", ai_out)
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            clean_summary = parsed.get("cleanSummary", "").strip()
            req_skills_str = parsed.get("reqSkills", "").strip()
            min_exp = parsed.get("minExp", "").strip()
            salary_range = parsed.get("salaryRange", "").strip()
        except Exception:
            pass

    # Clean navigation artifacts from LLM output
    if clean_summary:
        clean_summary = re.sub(r"(?i)skip\s+to\s+(main\s+)?content[\s•.-]*", "", clean_summary).strip()

    # Step 5: Section-aware NLP fallback if LLM failed or returned vague boilerplate
    is_vague = (
        not clean_summary
        or "official opening" in clean_summary.lower()
        or "millions of companies" in clean_summary.lower()
        or "increase the gdp" in clean_summary.lower()
        or "financial infrastructure" in clean_summary.lower()
        or len(clean_summary) < 50
    )

    if is_vague:
        clean_summary = build_summary_from_sections(sections, job_title, company)

    # Step 6: Skills - prefer mined skills, then LLM skills, then title keywords
    if mined_skills:
        req_skills_str = ", ".join(mined_skills[:12])
    elif not req_skills_str:
        title_keywords = [
            w for w in re.findall(r"\b[A-Za-z0-9+#./-]{2,}\b", job_title)
            if w.lower() not in {'and', 'the', 'for', 'with', 'at', 'in', 'of', 'job', 'position', 'role', 'senior', 'lead', 'staff', 'principal', 'ii', 'iii'}
        ]
        req_skills_str = ", ".join(title_keywords) if title_keywords else job_title

    # Step 7: Extract experience from description text
    if not min_exp:
        exp_match = re.search(r"(\d+)\+?\s*(?:[-–]\s*\d+)?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)?", clean_text, re.IGNORECASE)
        min_exp = f"{exp_match.group(1)}+ years" if exp_match else "Experience Not Specified"

    # Step 8: Extract salary from description text
    if not salary_range:
        sal_match = re.search(r"\$(\d{2,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:[-–]\s*\$(\d{2,3}(?:,\d{3})*(?:\.\d+)?))?(?:\s*(?:k|K|per year|annually|/yr))?", clean_text)
        if sal_match:
            low = sal_match.group(1)
            high = sal_match.group(2)
            salary_range = f"${low} - ${high}" if high else f"${low}"
        else:
            salary_range = "Competitive Salary"

    # Step 9: Full Job Description Refiner (ChatModel + Section-Aware NLP Fallback)
    refine_prompt = (
        f"You are an Executive Recruiter. Refine and format the raw job posting for '{job_title}' at '{company}'.\n"
        f"Rules:\n"
        f"1. Remove ALL navigation clutter (Sign in, Apply, Skip to content, Cookie policy, Footer links, Social sharing).\n"
        f"2. Structure into clean markdown headings:\n"
        f"   ## Role Overview\n"
        f"   ## Key Responsibilities\n"
        f"   ## Qualifications & Technical Stack\n"
        f"   ## Perks & Work Environment\n"
        f"3. Preserve all specific technical requirements, skills, and duties.\n\n"
        f"RAW POSTING TEXT:\n{clean_text[:2800]}"
    )
    refined_desc = query_hf(refine_prompt, max_tokens=650)
    if not refined_desc or len(refined_desc) < 80:
        refined_desc = refine_job_description_nlp(clean_text, job_title, company)

    # Step 10: Index into ChromaDB vector store
    try:
        doc_text = f"Title: {job_title} Company: {company} Skills: {req_skills_str} Summary: {clean_summary} Description: {clean_text[:1000]}"
        doc_id = re.sub(r"[^\w]", "_", f"{company}_{job_title}").lower()[:60]
        jobs_collection.upsert(
            documents=[doc_text],
            metadatas=[{"title": job_title, "company": company, "reqSkills": req_skills_str}],
            ids=[doc_id]
        )
    except Exception as err:
        print("[ChromaDB Index Error]:", err)

    return EnrichJobResponse(
        cleanSummary=clean_summary,
        reqSkills=req_skills_str,
        minExp=min_exp,
        salaryRange=salary_range,
        refinedDescription=refined_desc
    )


@app.post("/api/ai/vector-search", response_model=VectorSearchResponse)
def vector_search(req: VectorSearchRequest):
    if not req.query or jobs_collection.count() == 0:
        return VectorSearchResponse(results=[])

    try:
        query_results = jobs_collection.query(
            query_texts=[req.query],
            n_results=min(req.limit or 20, jobs_collection.count())
        )

        matches = []
        if query_results and "ids" in query_results and len(query_results["ids"]) > 0:
            ids = query_results["ids"][0]
            metadatas = query_results["metadatas"][0] if "metadatas" in query_results else []
            distances = query_results["distances"][0] if "distances" in query_results else []

            for idx, doc_id in enumerate(ids):
                meta = metadatas[idx] if idx < len(metadatas) else {}
                dist = distances[idx] if idx < len(distances) else 0.5
                sim_score = min(max(int((1.0 - dist) * 100 + 40), 50), 99)
                matches.append(VectorJobMatch(
                    url=doc_id,
                    title=meta.get("title", "Position"),
                    company=meta.get("company", "Company"),
                    similarityScore=sim_score
                ))

        return VectorSearchResponse(results=matches)
    except Exception as e:
        print("[Vector Search Error]:", e)
        return VectorSearchResponse(results=[])


@app.post("/api/ai/match-score", response_model=MatchScoreResponse)
def match_score(req: MatchScoreRequest):
    if not req.resumeText or not req.jobDescription:
        return MatchScoreResponse(matchScore=60)

    # Use skill-aware matching instead of raw word overlap
    resume_skills = set(s.lower() for s in mine_skills(req.resumeText))
    job_skills = set(s.lower() for s in mine_skills(req.jobDescription))

    if job_skills:
        overlap = len(resume_skills & job_skills)
        ratio = overlap / len(job_skills)
        score = min(max(int(ratio * 60 + 40), 45), 98)
    else:
        # Fallback to word overlap
        words_res = set(re.findall(r"\w{3,}", req.resumeText.lower()))
        words_job = set(re.findall(r"\w{3,}", req.jobDescription.lower()))
        if words_job:
            ratio = len(words_res & words_job) / len(words_job)
            score = min(max(int(ratio * 80 + 30), 45), 96)
        else:
            score = 60

    return MatchScoreResponse(matchScore=score)


@app.post("/api/ai/cover-letter", response_model=CoverLetterResponse)
def cover_letter(req: CoverLetterRequest):
    prompt = (
        f"Write a professional 3-paragraph cover letter for applying to '{req.jobTitle}' at '{req.company}'.\n"
        f"Candidate background: {req.resumeText[:500]}\n"
        f"Be specific about how the candidate's skills match this role."
    )
    letter = query_hf(prompt, 350)
    if not letter or len(letter) < 50:
        letter = (
            f"Dear Hiring Manager at {req.company},\n\n"
            f"I am excited to apply for the {req.jobTitle} position. "
            f"With my technical background and hands-on engineering experience, "
            f"I am confident I can contribute meaningfully to your team's goals.\n\n"
            f"I look forward to discussing how my skills align with your needs.\n\n"
            f"Best regards."
        )
    return CoverLetterResponse(coverLetter=letter)


@app.post("/api/ai/ats-breakdown", response_model=AtsBreakdownResponse)
def ats_breakdown(req: AtsBreakdownRequest):
    resume_skills = set(s.lower() for s in mine_skills(req.resumeText))
    job_skills_list = mine_skills(req.jobDescription)
    job_skills_set = set(s.lower() for s in job_skills_list)

    matched = []
    missing = []

    for s in job_skills_list:
        if s.lower() in resume_skills:
            if s not in matched:
                matched.append(s)
        else:
            if s not in missing:
                missing.append(s)

    if job_skills_set:
        ratio = len(matched) / len(job_skills_set)
        score = min(max(int(ratio * 60 + 40), 45), 98)
    else:
        score = 65

    recs = []
    if missing:
        top_missing = ", ".join(missing[:4])
        recs.append(f"Add target technical keywords to your candidate profile: {top_missing}.")
    recs.append("Highlight measurable metrics (e.g., 'improved API throughput by 40%', 'reduced bundle size by 25%').")
    recs.append(f"Ensure target position keywords for '{req.jobTitle}' are reflected in your profile resume summary.")

    # Tailored summary generator
    prompt = (
        f"Generate a concise 2-sentence tailored resume bullet point for a candidate applying to '{req.jobTitle}' at '{req.company}'.\n"
        f"Target skills: {', '.join(job_skills_list[:6])}\n"
        f"Candidate experience: {req.resumeText[:400]}"
    )
    tailored = query_hf(prompt, 200)
    if not tailored or len(tailored) < 30:
        tailored = f"Experienced software engineer delivering high-impact solutions for {req.jobTitle} roles at {req.company}, specializing in {', '.join(job_skills_list[:4]) if job_skills_list else 'modern web applications'}."

    return AtsBreakdownResponse(
        matchScore=score,
        matchedSkills=matched,
        missingSkills=missing,
        recommendations=recs,
        tailoredSummary=tailored
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
