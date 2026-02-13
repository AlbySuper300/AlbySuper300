from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
import re
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============= Models =============

class Scripture(BaseModel):
    reference: str  # e.g., "Giovanni 3:16"
    text: Optional[str] = None
    url: Optional[str] = None

class Presentation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    intro: str  # How to start the conversation
    main_points: List[str] = []  # Main discussion points
    questions: List[str] = []  # Questions to ask
    scriptures: List[Scripture] = []  # Bible scriptures
    objections: List[dict] = []  # Common objections and responses
    topic: Optional[str] = None  # Topic/theme
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_ai_generated: bool = False

class PresentationCreate(BaseModel):
    title: str
    intro: str
    main_points: List[str] = []
    questions: List[str] = []
    scriptures: List[Scripture] = []
    objections: List[dict] = []
    topic: Optional[str] = None

class PresentationUpdate(BaseModel):
    title: Optional[str] = None
    intro: Optional[str] = None
    main_points: Optional[List[str]] = None
    questions: Optional[List[str]] = None
    scriptures: Optional[List[Scripture]] = None
    objections: Optional[List[dict]] = None
    topic: Optional[str] = None

class GenerateRequest(BaseModel):
    topic: Optional[str] = None
    news_context: Optional[str] = None
    location: Optional[str] = None

class NewsResponse(BaseModel):
    title: str
    description: str
    source: str
    url: Optional[str] = None

# ============= Helper Functions =============

async def fetch_scripture_text_from_wol(url: str, book_num: str = None, chapter: str = None, verse_start: str = None, verse_end: str = None) -> Optional[str]:
    """Fetch the actual scripture text from wol.jw.org"""
    try:
        # Remove the fragment from URL for fetching
        base_url = url.split('#')[0]
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
            }
            response = await client.get(base_url, headers=headers, follow_redirects=True)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find all verse spans
                verses = soup.find_all('span', class_='v')
                
                if verses and verse_start and book_num and chapter:
                    # Extract specific verses
                    verse_start_int = int(verse_start)
                    verse_end_int = int(verse_end) if verse_end else verse_start_int
                    
                    text_parts = []
                    for verse in verses:
                        verse_id = verse.get('id', '')
                        if verse_id:
                            parts = verse_id.replace('v', '').split('-')
                            if len(parts) >= 3:
                                v_book = parts[0]
                                v_chapter = parts[1]
                                v_verse = int(parts[2])
                                
                                if (v_book == book_num and 
                                    v_chapter == chapter and 
                                    verse_start_int <= v_verse <= verse_end_int):
                                    clean_text = verse.get_text(strip=True)
                                    clean_text = clean_text.replace('+', '')
                                    clean_text = re.sub(r'\*', '', clean_text)
                                    text_parts.append(clean_text)
                    
                    if text_parts:
                        return ' '.join(text_parts)
                        
        return None
    except Exception as e:
        logger.warning(f"Could not fetch scripture text (may be due to network restrictions): {type(e).__name__}")
        return None

async def fetch_scripture_from_wol(reference: str) -> Optional[Scripture]:
    """Fetch scripture text from wol.jw.org"""
    try:
        # Convert reference to URL format
        search_query = reference.replace(" ", "+")
        
        # Use the Italian WOL site
        base_url = "https://wol.jw.org/it/wol/b/r6/lp-i/nwtsty"
        
        # Map book names to their WOL codes
        book_mapping = {
            "genesi": "1", "esodo": "2", "levitico": "3", "numeri": "4",
            "deuteronomio": "5", "giosuè": "6", "giudici": "7", "rut": "8",
            "1 samuele": "9", "2 samuele": "10", "1 re": "11", "2 re": "12",
            "1 cronache": "13", "2 cronache": "14", "esdra": "15", "neemia": "16",
            "ester": "17", "giobbe": "18", "salmi": "19", "proverbi": "20",
            "ecclesiaste": "21", "cantico dei cantici": "22", "isaia": "23",
            "geremia": "24", "lamentazioni": "25", "ezechiele": "26",
            "daniele": "27", "osea": "28", "gioele": "29", "amos": "30",
            "abdia": "31", "giona": "32", "michea": "33", "naum": "34",
            "abacuc": "35", "sofonia": "36", "aggeo": "37", "zaccaria": "38",
            "malachia": "39", "matteo": "40", "marco": "41", "luca": "42",
            "giovanni": "43", "atti": "44", "romani": "45", "1 corinti": "46",
            "2 corinti": "47", "galati": "48", "efesini": "49", "filippesi": "50",
            "colossesi": "51", "1 tessalonicesi": "52", "2 tessalonicesi": "53",
            "1 timoteo": "54", "2 timoteo": "55", "tito": "56", "filemone": "57",
            "ebrei": "58", "giacomo": "59", "1 pietro": "60", "2 pietro": "61",
            "1 giovanni": "62", "2 giovanni": "63", "3 giovanni": "64",
            "giuda": "65", "rivelazione": "66", "apocalisse": "66"
        }
        
        # Parse reference
        ref_lower = reference.lower().strip()
        book_num = None
        chapter = None
        verse = None
        verse_end = None
        
        for book_name, num in book_mapping.items():
            if ref_lower.startswith(book_name):
                book_num = num
                remaining = ref_lower[len(book_name):].strip()
                # Parse chapter:verse or chapter:verse-verse
                match = re.match(r'(\d+):(\d+)(?:-(\d+))?', remaining)
                if match:
                    chapter = match.group(1)
                    verse = match.group(2)
                    verse_end = match.group(3) if match.group(3) else verse
                break
        
        wol_url = None
        scripture_text = None
        
        if book_num and chapter:
            # Build WOL URL for the specific verse
            wol_url = f"https://wol.jw.org/it/wol/b/r6/lp-i/nwtsty/{book_num}/{chapter}"
            if verse:
                wol_url += f"#{book_num}:{chapter}:{verse}"
            
            # Try to fetch the text with verse info
            scripture_text = await fetch_scripture_text_from_wol(
                wol_url, 
                book_num=book_num, 
                chapter=chapter, 
                verse_start=verse, 
                verse_end=verse_end
            )
        else:
            # Fallback to search URL
            wol_url = f"https://wol.jw.org/it/wol/s/r6/lp-i?q={search_query}"
        
        return Scripture(
            reference=reference,
            text=scripture_text,
            url=wol_url
        )
        
    except Exception as e:
        logger.error(f"Error fetching scripture: {e}")
        return Scripture(reference=reference, text=None, url=None)

async def generate_presentation_with_ai(topic: str, news_context: str = None, existing_presentations: List[dict] = None) -> dict:
    """Generate a presentation using AI based on topic and context"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise ValueError("EMERGENT_LLM_KEY not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"jwpresent-{uuid.uuid4()}",
            system_message="""Sei un assistente esperto per i Testimoni di Geova. Il tuo compito è creare presentazioni per l'opera di predicazione casa per casa.
            
Le presentazioni devono essere:
- Rispettose e gentili
- Basate sulla Bibbia
- Pertinenti agli avvenimenti attuali quando possibile
- Pratiche e facili da usare

Rispondi sempre in italiano e in formato JSON con questa struttura:
{
    "title": "Titolo della presentazione",
    "intro": "Frase di apertura per iniziare la conversazione",
    "main_points": ["Punto 1", "Punto 2"],
    "questions": ["Domanda 1?", "Domanda 2?"],
    "scriptures": [{"reference": "Giovanni 3:16"}, {"reference": "Matteo 24:14"}],
    "objections": [{"objection": "Obiezione comune", "response": "Risposta suggerita"}],
    "topic": "Argomento principale"
}"""
        ).with_model("openai", "gpt-5.2")
        
        # Build the prompt
        prompt_parts = [f"Crea una presentazione per l'opera di predicazione sull'argomento: {topic}"]
        
        if news_context:
            prompt_parts.append(f"\nContesto delle notizie attuali: {news_context}")
        
        if existing_presentations and len(existing_presentations) > 0:
            examples = existing_presentations[:2]  # Use max 2 examples
            prompt_parts.append("\nUsa queste presentazioni esistenti come riferimento per lo stile:")
            for ex in examples:
                prompt_parts.append(f"- {ex.get('title', 'N/A')}: {ex.get('intro', 'N/A')}")
        
        prompt_parts.append("\nRispondi SOLO con il JSON, senza altro testo.")
        
        user_message = UserMessage(text="\n".join(prompt_parts))
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        # Clean response - remove markdown code blocks if present
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = re.sub(r'^```[\w]*\n?', '', response_text)
            response_text = re.sub(r'\n?```$', '', response_text)
        
        presentation_data = json.loads(response_text)
        return presentation_data
        
    except Exception as e:
        logger.error(f"Error generating presentation with AI: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

async def fetch_news(location: str = None) -> List[NewsResponse]:
    """Fetch current news - using a simple approach"""
    # In a production app, you would integrate with a news API
    # For now, we'll return some sample topics that are always relevant
    sample_news = [
        NewsResponse(
            title="Crisi economica globale",
            description="L'incertezza economica continua a preoccupare molte famiglie",
            source="Attualità",
            url=None
        ),
        NewsResponse(
            title="Cambiamenti climatici",
            description="Eventi meteorologici estremi in aumento",
            source="Ambiente",
            url=None
        ),
        NewsResponse(
            title="Tensioni internazionali",
            description="Conflitti e tensioni geopolitiche nel mondo",
            source="Politica internazionale",
            url=None
        ),
        NewsResponse(
            title="Salute mentale in crescita",
            description="Aumentano i casi di ansia e depressione",
            source="Salute",
            url=None
        ),
        NewsResponse(
            title="Crisi della famiglia",
            description="Sempre più famiglie in difficoltà",
            source="Società",
            url=None
        )
    ]
    return sample_news

# ============= API Routes =============

@api_router.get("/")
async def root():
    return {"message": "JW Present API", "version": "1.0.0"}

# Presentations CRUD
@api_router.post("/presentations", response_model=Presentation)
async def create_presentation(input: PresentationCreate):
    """Create a new presentation"""
    presentation_dict = input.dict()
    presentation_obj = Presentation(**presentation_dict)
    
    # Enrich scriptures with URLs
    enriched_scriptures = []
    for scripture in presentation_obj.scriptures:
        enriched = await fetch_scripture_from_wol(scripture.reference)
        enriched_scriptures.append(enriched)
    presentation_obj.scriptures = enriched_scriptures
    
    await db.presentations.insert_one(presentation_obj.dict())
    return presentation_obj

@api_router.get("/presentations", response_model=List[Presentation])
async def get_presentations():
    """Get all presentations"""
    presentations = await db.presentations.find().sort("updated_at", -1).to_list(100)
    return [Presentation(**p) for p in presentations]

@api_router.get("/presentations/{presentation_id}", response_model=Presentation)
async def get_presentation(presentation_id: str):
    """Get a single presentation by ID"""
    presentation = await db.presentations.find_one({"id": presentation_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return Presentation(**presentation)

@api_router.put("/presentations/{presentation_id}", response_model=Presentation)
async def update_presentation(presentation_id: str, input: PresentationUpdate):
    """Update a presentation"""
    presentation = await db.presentations.find_one({"id": presentation_id})
    if not presentation:
        raise HTTPException(status_code=404, detail="Presentation not found")
    
    update_data = {k: v for k, v in input.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Enrich scriptures if updated
    if "scriptures" in update_data:
        enriched_scriptures = []
        for scripture in update_data["scriptures"]:
            if isinstance(scripture, dict):
                enriched = await fetch_scripture_from_wol(scripture.get("reference", ""))
            else:
                enriched = await fetch_scripture_from_wol(scripture.reference)
            enriched_scriptures.append(enriched.dict())
        update_data["scriptures"] = enriched_scriptures
    
    await db.presentations.update_one(
        {"id": presentation_id},
        {"$set": update_data}
    )
    
    updated = await db.presentations.find_one({"id": presentation_id})
    return Presentation(**updated)

@api_router.delete("/presentations/{presentation_id}")
async def delete_presentation(presentation_id: str):
    """Delete a presentation"""
    result = await db.presentations.delete_one({"id": presentation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presentation not found")
    return {"message": "Presentation deleted successfully"}

# AI Generation
@api_router.post("/presentations/generate", response_model=Presentation)
async def generate_presentation(request: GenerateRequest):
    """Generate a presentation using AI"""
    topic = request.topic or "Speranza per il futuro"
    
    # Get existing presentations as examples
    existing = await db.presentations.find().limit(3).to_list(3)
    
    # Build news context
    news_context = request.news_context
    if not news_context and request.location:
        news = await fetch_news(request.location)
        if news:
            news_context = "; ".join([f"{n.title}: {n.description}" for n in news[:3]])
    
    # Generate with AI
    generated_data = await generate_presentation_with_ai(
        topic=topic,
        news_context=news_context,
        existing_presentations=existing
    )
    
    # Create presentation object
    presentation_obj = Presentation(
        title=generated_data.get("title", f"Presentazione su {topic}"),
        intro=generated_data.get("intro", ""),
        main_points=generated_data.get("main_points", []),
        questions=generated_data.get("questions", []),
        scriptures=[Scripture(**s) for s in generated_data.get("scriptures", [])],
        objections=generated_data.get("objections", []),
        topic=generated_data.get("topic", topic),
        is_ai_generated=True
    )
    
    # Enrich scriptures with URLs
    enriched_scriptures = []
    for scripture in presentation_obj.scriptures:
        enriched = await fetch_scripture_from_wol(scripture.reference)
        enriched_scriptures.append(enriched)
    presentation_obj.scriptures = enriched_scriptures
    
    # Save to database
    await db.presentations.insert_one(presentation_obj.dict())
    
    return presentation_obj

# News
@api_router.get("/news", response_model=List[NewsResponse])
async def get_news(location: Optional[str] = None):
    """Get current news topics"""
    return await fetch_news(location)

# Scripture lookup
@api_router.get("/scriptures/lookup")
async def lookup_scripture(reference: str):
    """Look up a scripture and get its WOL URL"""
    scripture = await fetch_scripture_from_wol(reference)
    return scripture

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
